import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRedisGet = vi.hoisted(() => vi.fn());
const mockIsProActive = vi.hoisted(() => vi.fn());
const mockRateLimit = vi.hoisted(() => vi.fn());
const mockCountFocusDays = vi.hoisted(() => vi.fn());
const configuredSeason = vi.hoisted(() => ({ id: "21day-mind-challenge-2026-q3" }));

vi.mock("@upstash/redis", () => ({
  Redis: { fromEnv: vi.fn(() => ({ get: mockRedisGet })) },
}));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServer: vi.fn() }));
vi.mock("@/lib/pro/is-active", () => ({ isProActive: mockIsProActive }));
vi.mock("@/lib/server/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  hashWallet: (w: string) => `hash:${w.slice(0, 6)}`,
}));
vi.mock("@/lib/server/demo-signing", () => ({
  enforceFocusDayRateLimit: mockRateLimit,
}));
vi.mock("@/lib/season-pass/focus-ledger-init", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/season-pass/focus-ledger-init")>();
  return { ...actual, countFocusDays: mockCountFocusDays };
});
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

import { POST } from "../route";
import { getSupabaseServer } from "@/lib/supabase/server";

const mockedSupabase = vi.mocked(getSupabaseServer);
const WALLET = "0xAAAAbbbbccccddddeeeeffff0000111122223333";
const LOWER = WALLET.toLowerCase();
const ROW_SEASON = "21day-mind-challenge-2026-q3";
const DAY_MS = 86_400_000;
const EXPIRES_FUTURE = new Date(Date.now() + 15 * DAY_MS).toISOString();

const utcDate = (offsetDays = 0) =>
  new Date(Date.now() + offsetDays * DAY_MS).toISOString().slice(0, 10);

type Upsert = { rows: unknown; options: unknown };

function buildSupabase(
  opts: {
    row?: Record<string, unknown> | null;
    rowError?: unknown;
    inserted?: unknown[];
    upsertError?: unknown;
  } = {},
) {
  const upserts: Upsert[] = [];

  const from = vi.fn((table: string) => {
    if (table === "lite_season_passes") {
      const maybeSingle = vi.fn().mockResolvedValue({
        data: opts.row ?? null,
        error: opts.rowError ?? null,
      });
      const limit = vi.fn(() => ({ maybeSingle }));
      const order = vi.fn(() => ({ limit }));
      const gt = vi.fn(() => ({ order }));
      const eq = vi.fn(() => ({ gt }));
      return { select: vi.fn(() => ({ eq })) };
    }
    return {
      upsert: vi.fn((rows: unknown, options: unknown) => {
        upserts.push({ rows, options });
        return {
          select: vi.fn(() =>
            Promise.resolve({
              data: opts.inserted ?? [{ id: "row-1" }],
              error: opts.upsertError ?? null,
            }),
          ),
        };
      }),
    };
  });

  return { supabase: { from } as never, upserts };
}

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/focus-day", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const activeRow = {
  expires_at: EXPIRES_FUTURE,
  season_id: ROW_SEASON,
  supporter_status: "challenger",
  shields_credited: 3,
};

beforeEach(() => {
  configuredSeason.id = ROW_SEASON;
  vi.unstubAllEnvs();
  vi.stubEnv("FOCUS_DAYS_LEDGER_ENABLED", "true");
  mockRedisGet.mockReset().mockResolvedValue(null);
  mockIsProActive.mockReset().mockResolvedValue({ active: false, expiresAt: null });
  mockRateLimit.mockReset().mockResolvedValue(undefined);
  mockCountFocusDays.mockReset().mockResolvedValue(1);
  mockedSupabase.mockReset();
  mockedSupabase.mockReturnValue(buildSupabase({ row: activeRow }).supabase);
});

describe("input validation", () => {
  it("rejects a malformed wallet", async () => {
    const res = await POST(makeRequest({ wallet: "nope" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_wallet");
  });

  it("rejects a body that is not an object", async () => {
    const res = await POST(makeRequest("just a string"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_wallet");
  });

  it("rejects a body that is not JSON", async () => {
    const res = await POST(
      new Request("http://localhost/api/focus-day", { method: "POST", body: "{" }),
    );
    expect(res.status).toBe(400);
  });
});

describe("gate", () => {
  it("writes nothing when the flag is off", async () => {
    vi.unstubAllEnvs();
    const { supabase, upserts } = buildSupabase({ row: activeRow });
    mockedSupabase.mockReturnValue(supabase);

    const res = await POST(makeRequest({ wallet: WALLET }));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("disabled");
    expect(upserts).toHaveLength(0);
  });

  it("obeys a Redis override over the deployment default", async () => {
    mockRedisGet.mockResolvedValue("false");
    const res = await POST(makeRequest({ wallet: WALLET }));
    expect((await res.json()).error).toBe("disabled");
  });
});

describe("rate limit", () => {
  it("answers rate_limited without touching the ledger", async () => {
    const { supabase, upserts } = buildSupabase({ row: activeRow });
    mockedSupabase.mockReturnValue(supabase);
    mockRateLimit.mockRejectedValue(new Error("Rate limit exceeded"));

    const res = await POST(makeRequest({ wallet: WALLET }));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("rate_limited");
    expect(upserts).toHaveLength(0);
  });

  it("limits per wallet, lowercased", async () => {
    await POST(makeRequest({ wallet: WALLET }));
    expect(mockRateLimit).toHaveBeenCalledWith(LOWER);
  });
});

describe("entitlement", () => {
  // AC8 — no pass, no row, ever.
  it("refuses to write without an entitlement", async () => {
    const { supabase, upserts } = buildSupabase({ row: null });
    mockedSupabase.mockReturnValue(supabase);

    const res = await POST(makeRequest({ wallet: WALLET }));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("no_entitlement");
    expect(upserts).toHaveLength(0);
  });

  it("is unavailable, not unentitled, when the ledger cannot answer", async () => {
    mockedSupabase.mockReturnValue(null as never);
    const res = await POST(makeRequest({ wallet: WALLET }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("ledger_unavailable");
  });
});

describe("writing a day", () => {
  it("records today under the season the wallet bought", async () => {
    configuredSeason.id = "21day-mind-challenge-2026-q4";
    const { supabase, upserts } = buildSupabase({ row: activeRow });
    mockedSupabase.mockReturnValue(supabase);
    mockCountFocusDays.mockResolvedValue(6);

    const res = await POST(makeRequest({ wallet: WALLET }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      progress: { completed: 6, goal: 21 },
    });
    expect(upserts[0].rows).toEqual({
      wallet: LOWER,
      season_id: ROW_SEASON,
      date_utc: utcDate(),
      source: "daily",
    });
    expect(upserts[0].options).toEqual({
      onConflict: "wallet,season_id,date_utc",
      ignoreDuplicates: true,
    });
  });

  // AC7 — the second POST of the day is a no-op that still answers normally.
  it("answers the same progress on a duplicate", async () => {
    const { supabase } = buildSupabase({ row: activeRow, inserted: [] });
    mockedSupabase.mockReturnValue(supabase);
    mockCountFocusDays.mockResolvedValue(6);

    const res = await POST(makeRequest({ wallet: WALLET }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      progress: { completed: 6, goal: 21 },
    });
  });

  // AC10 — an explicit date is a reconciliation, and says so in the row.
  it("tags an explicit date as a retry", async () => {
    const { supabase, upserts } = buildSupabase({ row: activeRow });
    mockedSupabase.mockReturnValue(supabase);

    const res = await POST(makeRequest({ wallet: WALLET, date: utcDate(-1) }));
    expect(res.status).toBe(200);
    expect(upserts[0].rows).toMatchObject({
      date_utc: utcDate(-1),
      source: "daily_retry",
    });
  });

  it("clamps the reported progress to the goal", async () => {
    mockCountFocusDays.mockResolvedValue(99);
    const json = await (await POST(makeRequest({ wallet: WALLET }))).json();
    expect(json.progress).toEqual({ completed: 21, goal: 21 });
  });

  it("is unavailable when the write fails", async () => {
    const { supabase } = buildSupabase({
      row: activeRow,
      upsertError: { code: "unavailable" },
    });
    mockedSupabase.mockReturnValue(supabase);

    const res = await POST(makeRequest({ wallet: WALLET }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("ledger_unavailable");
  });

  it("is unavailable when the count cannot be read after the write", async () => {
    mockCountFocusDays.mockResolvedValue(null);
    const res = await POST(makeRequest({ wallet: WALLET }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("ledger_unavailable");
  });

  it("counts PRO progress against the configured season", async () => {
    configuredSeason.id = "21day-mind-challenge-2026-q4";
    mockIsProActive.mockResolvedValue({
      active: true,
      expiresAt: Date.now() + 7 * DAY_MS,
    });
    const { supabase, upserts } = buildSupabase({ row: null });
    mockedSupabase.mockReturnValue(supabase);

    const res = await POST(makeRequest({ wallet: WALLET }));
    expect(res.status).toBe(200);
    expect(upserts[0].rows).toMatchObject({
      season_id: "21day-mind-challenge-2026-q4",
      source: "daily",
    });
  });
});

// AC9 — the endpoint is not an arbitrary registrar of history.
describe("date rules", () => {
  const rejects = async (date: unknown) => {
    const { supabase, upserts } = buildSupabase({ row: activeRow });
    mockedSupabase.mockReturnValue(supabase);

    const res = await POST(makeRequest({ wallet: WALLET, date }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_date");
    expect(upserts).toHaveLength(0);
  };

  it("rejects a date older than yesterday", () => rejects(utcDate(-2)));
  it("rejects a future date", () => rejects(utcDate(1)));
  it("rejects a malformed date", () => rejects("27-07-2026"));
  it("rejects a non-string date", () => rejects(42));

  it("rejects a date before the pass opened", async () => {
    const { supabase, upserts } = buildSupabase({
      // 21-day pass that opened today: yesterday predates the purchase.
      row: { ...activeRow, expires_at: new Date(Date.now() + 21 * DAY_MS).toISOString() },
    });
    mockedSupabase.mockReturnValue(supabase);

    const res = await POST(makeRequest({ wallet: WALLET, date: utcDate(-1) }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_date");
    expect(upserts).toHaveLength(0);
  });
});
