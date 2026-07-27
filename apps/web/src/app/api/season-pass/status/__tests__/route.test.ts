import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockRedisGet = vi.hoisted(() => vi.fn());
const mockIsProActive = vi.hoisted(() => vi.fn());
const configuredSeason = vi.hoisted(() => ({ id: "21day-mind-challenge-2026-q3" }));
vi.mock("@upstash/redis", () => ({
  Redis: { fromEnv: vi.fn(() => ({ get: mockRedisGet })) },
}));

// The configured season is a moving target: a rollover edits it while purchased
// passes are still alive. Tests that care about attribution set it explicitly.
vi.mock("@/lib/payments/rail-config", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/payments/rail-config")>();
  return {
    ...actual,
    getSeasonPass: (sku: "lite_season_pass_21") => ({
      ...actual.getSeasonPass(sku),
      seasonId: configuredSeason.id,
    }),
  };
});

vi.mock("@/lib/supabase/server", () => ({ getSupabaseServer: vi.fn() }));
vi.mock("@/lib/pro/is-active", () => ({ isProActive: mockIsProActive }));
vi.mock("@/lib/server/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import { GET } from "../route";
import { getSupabaseServer } from "@/lib/supabase/server";

const mockedSupabase = vi.mocked(getSupabaseServer);
const WALLET = "0xaaaabbbbccccddddeeeeffff0000111122223333";
const EXPIRES_FUTURE = new Date(Date.now() + 20 * 86_400_000).toISOString();
const EXPIRES_PAST = new Date(Date.now() - 1000).toISOString();

function makeRequest(wallet?: string) {
  const url = wallet
    ? `http://localhost/api/season-pass/status?wallet=${wallet}`
    : `http://localhost/api/season-pass/status`;
  return new Request(url);
}

function buildDbMock(row: Record<string, unknown> | null, error: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: row, error });
  const limit = vi.fn(() => ({ maybeSingle }));
  const order = vi.fn(() => ({ limit }));
  const gt = vi.fn(() => ({ order }));
  const eq = vi.fn(() => ({ gt }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { supabase: { from } as never };
}

beforeEach(() => {
  configuredSeason.id = "21day-mind-challenge-2026-q3";
  mockRedisGet.mockReset().mockResolvedValue(null);
  mockIsProActive.mockReset().mockResolvedValue({ active: false, expiresAt: null });
  mockedSupabase.mockReset();
  mockedSupabase.mockReturnValue(buildDbMock(null).supabase);
});
afterEach(() => vi.restoreAllMocks());

describe("input validation", () => {
  it("missing wallet → 400 invalid_wallet", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_wallet");
  });

  it("invalid wallet format → 400 invalid_wallet", async () => {
    const res = await GET(makeRequest("not-an-address"));
    expect(res.status).toBe(400);
  });
});

describe("redis fast path", () => {
  it("valid redis entry → active:true from redis", async () => {
    mockRedisGet.mockResolvedValue(EXPIRES_FUTURE);
    const res = await GET(makeRequest(WALLET));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.active).toBe(true);
    expect(json.expiresAt).toBe(EXPIRES_FUTURE);
    expect(json.source).toBe("season_pass");
    expect(json.storageSource).toBe("redis");
  });

  it("still authorizes from Redis when the ledger is down (access never degrades)", async () => {
    mockRedisGet.mockResolvedValue(EXPIRES_FUTURE);
    mockedSupabase.mockReturnValue(null as never);

    const res = await GET(makeRequest(WALLET));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.active).toBe(true);
    expect(json.source).toBe("season_pass");
    expect(json.storageSource).toBe("redis");
  });

  it("expired redis entry → falls through to db", async () => {
    mockRedisGet.mockResolvedValue(EXPIRES_PAST);
    mockedSupabase.mockReturnValue(buildDbMock(null).supabase);
    const res = await GET(makeRequest(WALLET));
    const json = await res.json();
    expect(json.active).toBe(false);
    expect(mockedSupabase).toHaveBeenCalled();
  });
});

describe("supabase fallback", () => {
  it("active pass in db → active:true", async () => {
    const row = {
      expires_at: EXPIRES_FUTURE,
      season_id: "21day-mind-challenge-2026-q3",
      supporter_status: "challenger",
      shields_credited: 3,
    };
    mockedSupabase.mockReturnValue(buildDbMock(row).supabase);
    const res = await GET(makeRequest(WALLET));
    const json = await res.json();
    expect(json.active).toBe(true);
    expect(json.seasonId).toBe("21day-mind-challenge-2026-q3");
    expect(json.supporterStatus).toBe("challenger");
    expect(json.shieldsCredited).toBe(3);
    expect(json.source).toBe("season_pass");
    expect(json.storageSource).toBe("db");
  });

  it("no pass in db → active:false", async () => {
    mockedSupabase.mockReturnValue(buildDbMock(null).supabase);
    const res = await GET(makeRequest(WALLET));
    expect((await res.json()).active).toBe(false);
  });

  it("supabase unavailable → 503", async () => {
    mockedSupabase.mockReturnValue(null as never);
    const res = await GET(makeRequest(WALLET));
    expect(res.status).toBe(503);
  });

  it("db failure stays unresolved instead of claiming the pass is inactive", async () => {
    mockedSupabase.mockReturnValue(
      buildDbMock(null, { code: "database_unavailable" }).supabase,
    );

    const res = await GET(makeRequest(WALLET));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({
      active: false,
      source: null,
      error: "ledger_unavailable",
    });
  });

  it("unexpected ledger failure stays unresolved", async () => {
    const from = vi.fn(() => {
      throw new Error("database unavailable");
    });
    mockedSupabase.mockReturnValue({ from } as never);

    const res = await GET(makeRequest(WALLET));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({
      active: false,
      source: null,
      error: "ledger_unavailable",
    });
  });
});

describe("canonical seasonId", () => {
  const ROW_SEASON = "21day-mind-challenge-2026-q3";
  const activeRow = {
    expires_at: EXPIRES_FUTURE,
    season_id: ROW_SEASON,
    supporter_status: "challenger",
    shields_credited: 3,
  };

  // AC30 — the fast path must not invent a season. Redis caches the
  // entitlement; it does not know which season was purchased.
  it("uses the purchased row's season even when Redis served the entitlement and the config rolled", async () => {
    configuredSeason.id = "21day-mind-challenge-2026-q4";
    mockRedisGet.mockResolvedValue(EXPIRES_FUTURE);
    mockedSupabase.mockReturnValue(buildDbMock(activeRow).supabase);

    const json = await (await GET(makeRequest(WALLET))).json();
    expect(json.active).toBe(true);
    expect(json.seasonId).toBe(ROW_SEASON);
  });

  // AC25 — same rule on the plain DB path: the config never overwrites the row.
  it("uses the purchased row's season on the db path with a rolled config", async () => {
    configuredSeason.id = "21day-mind-challenge-2026-q4";
    mockedSupabase.mockReturnValue(buildDbMock(activeRow).supabase);

    const json = await (await GET(makeRequest(WALLET))).json();
    expect(json.seasonId).toBe(ROW_SEASON);
  });

  // AC26 — a buyer whose row could not be read keeps access and gets NO season.
  // Substituting the configured literal here is how progress lands under the
  // wrong temporada after a rollover.
  it("returns a null season for a buyer whose row could not be read", async () => {
    configuredSeason.id = "21day-mind-challenge-2026-q4";
    mockRedisGet.mockResolvedValue(EXPIRES_FUTURE);
    mockedSupabase.mockReturnValue(null as never);

    const json = await (await GET(makeRequest(WALLET))).json();
    expect(json.active).toBe(true);
    expect(json.seasonId).toBeNull();
  });

  it("returns a null season when no entitlement is active", async () => {
    const json = await (await GET(makeRequest(WALLET))).json();
    expect(json.active).toBe(false);
    expect(json.seasonId).toBeNull();
  });

  it("gives PRO the configured season, not the row's", async () => {
    configuredSeason.id = "21day-mind-challenge-2026-q4";
    mockIsProActive.mockResolvedValue({
      active: true,
      expiresAt: Date.now() + 7 * 86_400_000,
    });
    mockedSupabase.mockReturnValue(buildDbMock(activeRow).supabase);

    const json = await (await GET(makeRequest(WALLET))).json();
    expect(json.source).toBe("pro");
    expect(json.seasonId).toBe("21day-mind-challenge-2026-q4");
  });
});

describe("effective Training Pass", () => {
  it("returns active source=pro without requiring a Season Pass ledger", async () => {
    const proExpiresAt = Date.now() + 7 * 86_400_000;
    mockIsProActive.mockResolvedValue({ active: true, expiresAt: proExpiresAt });
    mockedSupabase.mockReturnValue(null as never);

    const res = await GET(makeRequest(WALLET));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      active: true,
      source: "pro",
      seasonPassExpiresAt: null,
      proExpiresAt,
      // PRO has no purchased row, so its season is the configured one — the
      // only case where the config is the legitimate source.
      seasonId: "21day-mind-challenge-2026-q3",
    });
  });

  it("prefers source=pro when PRO and a cached Season Pass are both active", async () => {
    const proExpiresAt = Date.now() + 7 * 86_400_000;
    mockIsProActive.mockResolvedValue({ active: true, expiresAt: proExpiresAt });
    mockRedisGet.mockResolvedValue(EXPIRES_FUTURE);

    const json = await (await GET(makeRequest(WALLET))).json();
    expect(json).toMatchObject({
      active: true,
      source: "pro",
      seasonPassExpiresAt: EXPIRES_FUTURE,
      proExpiresAt,
      shieldsCredited: 3,
    });
  });

  it("fails closed when PRO status cannot be checked", async () => {
    mockIsProActive.mockRejectedValue(new Error("redis unavailable"));

    const res = await GET(makeRequest(WALLET));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({
      active: false,
      source: null,
      error: "entitlement_unavailable",
    });
    expect(mockedSupabase).not.toHaveBeenCalled();
  });

  it("preserves confirmed PRO coverage when the Season Pass ledger fails", async () => {
    const proExpiresAt = Date.now() + 7 * 86_400_000;
    mockIsProActive.mockResolvedValue({ active: true, expiresAt: proExpiresAt });
    mockedSupabase.mockReturnValue(
      buildDbMock(null, { code: "database_unavailable" }).supabase,
    );

    const res = await GET(makeRequest(WALLET));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      active: true,
      source: "pro",
      proExpiresAt,
    });
  });
});
