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
      // Pass that opened TODAY: its expiry is exactly one full access window
      // away, so yesterday predates the purchase. Tied to the access duration
      // (30), not to the goal — see the AC4(a) case below for why that matters.
      row: { ...activeRow, expires_at: new Date(Date.now() + 30 * DAY_MS).toISOString() },
    });
    mockedSupabase.mockReturnValue(supabase);

    const res = await POST(makeRequest({ wallet: WALLET, date: utcDate(-1) }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_date");
    expect(upserts).toHaveLength(0);
  });
});

describe("AC4 · discriminación 21≠30 — los dos números, cada uno en su lugar", () => {
  // (a) ELEGIBILIDAD ← accessDurationDays (30).
  //
  // Un pase que vence en 21 días abrió su ventana hace 9 (30 − 21), así que
  // ayer cae DENTRO. Con la ventana atada a 21 el inicio sería hoy y ayer
  // quedaría afuera: por eso este caso separa las dos constantes en vez de
  // confirmarlas juntas.
  it("AC4(a) · acepta una fecha que sólo es elegible con la ventana de 30", async () => {
    const { supabase, upserts } = buildSupabase({
      row: { ...activeRow, expires_at: new Date(Date.now() + 21 * DAY_MS).toISOString() },
    });
    mockedSupabase.mockReturnValue(supabase);

    const res = await POST(makeRequest({ wallet: WALLET, date: utcDate(-1) }));

    expect(res.status).toBe(200);
    expect(upserts).toHaveLength(1);
  });

  // (b) PROGRESO ← challengeGoalDays (21).
  //
  // ⚠️ Las 30 filas son un FIXTURE DEFENSIVO, no un estado que el POST pueda
  // producir: el flujo normal se cierra en 21 (Behavior 6b/AC8), y el backfill
  // inicial ya capa en `goal` (focus-days.ts:188). Se usan aquí para probar que
  // el clamp de presentación sobrevive a datos anómalos — históricos, fixtures
  // o concurrencia — y que la meta reportada es 21, no la ventana.
  it("AC4(b) · reporta goal 21 y clampea, aun con más filas de las alcanzables", async () => {
    mockCountFocusDays.mockResolvedValue(30);

    const res = await POST(makeRequest({ wallet: WALLET }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.progress).toEqual({ completed: 21, goal: 21 });
    expect(json.progress.goal).not.toBe(30);
  });
});
