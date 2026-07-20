import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockRedisGet = vi.hoisted(() => vi.fn());
const mockIsProActive = vi.hoisted(() => vi.fn());
vi.mock("@upstash/redis", () => ({
  Redis: { fromEnv: vi.fn(() => ({ get: mockRedisGet })) },
}));

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
    expect(mockedSupabase).not.toHaveBeenCalled();
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
