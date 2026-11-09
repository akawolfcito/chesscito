import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockCountFocusDays = vi.hoisted(() => vi.fn());
const mockEnsureInit = vi.hoisted(() => vi.fn());
vi.mock("@/lib/season-pass/focus-ledger-init", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/season-pass/focus-ledger-init")>();
  return {
    ...actual,
    countFocusDays: mockCountFocusDays,
    ensureFocusLedgerInitialized: mockEnsureInit,
  };
});

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
// Estable a propósito: `createLogger: () => ({ info: vi.fn() })` devolvía una
// función nueva por llamada, así que nada de lo que la ruta loguea era
// observable. AC12 necesita verlo.
const logSpy = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@/lib/server/logger", () => ({
  createLogger: () => logSpy,
  // Never the raw wallet in a log line, not even in tests.
  hashWallet: (w: string) => `hash:${w.slice(0, 6)}`,
}));

import { GET } from "../route";
import { getSupabaseServer } from "@/lib/supabase/server";

const mockedSupabase = vi.mocked(getSupabaseServer);
const WALLET = "0xaaaabbbbccccddddeeeeffff0000111122223333";
const EXPIRES_FUTURE = new Date(Date.now() + 20 * 86_400_000).toISOString();
const EXPIRES_PAST = new Date(Date.now() - 1000).toISOString();

function makeRequest(wallet?: string, extraQuery = "") {
  const url = wallet
    ? `http://localhost/api/season-pass/status?wallet=${wallet}${extraQuery}`
    : `http://localhost/api/season-pass/status`;
  return new Request(url);
}

/** Redis serves two different keys here: the entitlement and the kill switch. */
function redisReturning(values: { pass?: string | null; gate?: string | null }) {
  mockRedisGet.mockImplementation(async (key: string) =>
    key === "focus-days-ledger:enabled" ? (values.gate ?? null) : (values.pass ?? null),
  );
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
  vi.unstubAllEnvs();
  mockCountFocusDays.mockReset().mockResolvedValue(0);
  mockEnsureInit.mockReset().mockResolvedValue({ status: "skipped", seededRows: 0 });
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

describe("focusDays slice", () => {
  const ROW_SEASON = "21day-mind-challenge-2026-q3";
  const activeRow = {
    expires_at: EXPIRES_FUTURE,
    season_id: ROW_SEASON,
    supporter_status: "challenger",
    shields_credited: 3,
  };

  function withActivePass() {
    mockedSupabase.mockReturnValue(buildDbMock(activeRow).supabase);
  }

  it("is disabled by default, and reads nothing", async () => {
    withActivePass();
    const json = await (await GET(makeRequest(WALLET))).json();

    expect(json.focusDays).toEqual({ status: "disabled" });
    expect(mockCountFocusDays).not.toHaveBeenCalled();
    expect(mockEnsureInit).not.toHaveBeenCalled();
  });

  it("reports progress once the env flag is on", async () => {
    // El spy es compartido y `beforeEach` no lo limpia: sin esto, un test que
    // no logueara nada leería la línea de un caso anterior y pasaría en falso.
    logSpy.info.mockClear();
    vi.stubEnv("FOCUS_DAYS_LEDGER_ENABLED", "true");
    withActivePass();
    mockCountFocusDays.mockResolvedValue(5);

    const json = await (await GET(makeRequest(WALLET))).json();
    expect(json.focusDays).toEqual({
      status: "ok",
      completed: 5,
      goal: 21,
      seasonId: ROW_SEASON,
    });
  });

  // AC3 · discriminación 21≠30 — la meta que viaja al cliente es
  // challengeGoalDays (21), nunca accessDurationDays (30).
  //
  // ⚠️ Este caso NO puede empezar en rojo: hoy un solo número hace los dos
  // trabajos, así que `goal` ya vale 21 por coincidencia. Su valor está en la
  // MUTACIÓN: al intercambiar las dos constantes debe ponerse rojo, que es lo
  // que prueba que la meta quedó atada al campo correcto y no al que sobró.
  it("AC3 · discriminación 21≠30 — el goal es la meta (21), no la ventana (30)", async () => {
    // El spy es compartido y `beforeEach` no lo limpia: sin esto, un test que
    // no logueara nada leería la línea de un caso anterior y pasaría en falso.
    logSpy.info.mockClear();
    vi.stubEnv("FOCUS_DAYS_LEDGER_ENABLED", "true");
    withActivePass();
    mockCountFocusDays.mockResolvedValue(5);

    const json = await (await GET(makeRequest(WALLET))).json();

    expect(json.focusDays.goal).toBe(21);
    expect(json.focusDays.goal).not.toBe(30);
  });

  // AC12 — observabilidad. El cambio mueve una constante que nadie mira: si un
  // call site elige el número equivocado, sin esto nos enteramos por un reporte
  // de jugador. La línea lleva las DOS constantes juntas, que es lo que permite
  // ver un cruce de un vistazo.
  it("AC12 · loguea la forma de la temporada y el estado resuelto", async () => {
    // El spy es compartido y `beforeEach` no lo limpia: sin esto, un test que
    // no logueara nada leería la línea de un caso anterior y pasaría en falso.
    logSpy.info.mockClear();
    vi.stubEnv("FOCUS_DAYS_LEDGER_ENABLED", "true");
    withActivePass();
    mockCountFocusDays.mockResolvedValue(5);

    await GET(makeRequest(WALLET));

    const call = logSpy.info.mock.calls.filter(([event]) => event === "focus_days_status").at(-1);
    expect(call).toBeDefined();
    const payload = call![1] as Record<string, unknown>;

    expect(payload).toMatchObject({
      challenge_goal_days: 21,
      access_duration_days: 30,
      completed: 5,
      state: "active",
    });
    expect(payload.days_remaining).toEqual(expect.any(Number));

    // Nunca la wallet completa: sólo el hash que usa el resto de las rutas.
    expect(payload.wallet).toBe(`hash:${WALLET.slice(0, 6)}`);
    expect(JSON.stringify(payload)).not.toContain(WALLET);
  });

  it("AC12 · el estado distingue completado de en curso", async () => {
    // El spy es compartido y `beforeEach` no lo limpia: sin esto, un test que
    // no logueara nada leería la línea de un caso anterior y pasaría en falso.
    logSpy.info.mockClear();
    vi.stubEnv("FOCUS_DAYS_LEDGER_ENABLED", "true");
    withActivePass();
    mockCountFocusDays.mockResolvedValue(21);

    await GET(makeRequest(WALLET));

    const call = logSpy.info.mock.calls.filter(([event]) => event === "focus_days_status").at(-1);
    expect((call![1] as Record<string, unknown>).state).toBe("completed");
  });

  // AC27 wiring — the Redis override outranks the deployment default.
  it("lets the Redis override turn it off without a redeploy", async () => {
    // El spy es compartido y `beforeEach` no lo limpia: sin esto, un test que
    // no logueara nada leería la línea de un caso anterior y pasaría en falso.
    logSpy.info.mockClear();
    vi.stubEnv("FOCUS_DAYS_LEDGER_ENABLED", "true");
    withActivePass();
    redisReturning({ gate: "false" });

    const json = await (await GET(makeRequest(WALLET))).json();
    expect(json.focusDays).toEqual({ status: "disabled" });
    expect(mockCountFocusDays).not.toHaveBeenCalled();
  });

  // AC26 — access from Redis, progress degraded. Not the same failure.
  it("degrades to unavailable when the ledger is down but access is not", async () => {
    vi.stubEnv("FOCUS_DAYS_LEDGER_ENABLED", "true");
    redisReturning({ pass: EXPIRES_FUTURE });
    mockedSupabase.mockReturnValue(null as never);

    const res = await GET(makeRequest(WALLET));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.active).toBe(true);
    expect(json.focusDays).toEqual({ status: "unavailable" });
  });

  it("degrades to unavailable when the count cannot be read", async () => {
    // El spy es compartido y `beforeEach` no lo limpia: sin esto, un test que
    // no logueara nada leería la línea de un caso anterior y pasaría en falso.
    logSpy.info.mockClear();
    vi.stubEnv("FOCUS_DAYS_LEDGER_ENABLED", "true");
    withActivePass();
    mockCountFocusDays.mockResolvedValue(null);

    const json = await (await GET(makeRequest(WALLET))).json();
    expect(json.focusDays).toEqual({ status: "unavailable" });
  });

  it("carries no slice at all without an entitlement", async () => {
    vi.stubEnv("FOCUS_DAYS_LEDGER_ENABLED", "true");
    const json = await (await GET(makeRequest(WALLET))).json();

    expect(json.active).toBe(false);
    expect(json.focusDays).toBeUndefined();
    expect(mockCountFocusDays).not.toHaveBeenCalled();
  });

  it("hands the client's own report to the backfill", async () => {
    // El spy es compartido y `beforeEach` no lo limpia: sin esto, un test que
    // no logueara nada leería la línea de un caso anterior y pasaría en falso.
    logSpy.info.mockClear();
    vi.stubEnv("FOCUS_DAYS_LEDGER_ENABLED", "true");
    withActivePass();

    await GET(makeRequest(WALLET, "&streak=4&lastCompletedDate=2026-07-27"));
    expect(mockEnsureInit).toHaveBeenCalledWith(
      expect.objectContaining({
        wallet: WALLET,
        seasonId: ROW_SEASON,
        report: { streak: 4, lastCompletedDate: "2026-07-27" },
        goal: 21,
      }),
    );
  });

  it("backfills before counting, so the first load is not a zero", async () => {
    // El spy es compartido y `beforeEach` no lo limpia: sin esto, un test que
    // no logueara nada leería la línea de un caso anterior y pasaría en falso.
    logSpy.info.mockClear();
    vi.stubEnv("FOCUS_DAYS_LEDGER_ENABLED", "true");
    withActivePass();
    const order: string[] = [];
    mockEnsureInit.mockImplementation(async () => {
      order.push("init");
      return { status: "seeded", seededRows: 4 };
    });
    mockCountFocusDays.mockImplementation(async () => {
      order.push("count");
      return 4;
    });

    await GET(makeRequest(WALLET, "&streak=4&lastCompletedDate=2026-07-27"));
    expect(order).toEqual(["init", "count"]);
  });

  it("never caches: the response initializes the ledger", async () => {
    // El spy es compartido y `beforeEach` no lo limpia: sin esto, un test que
    // no logueara nada leería la línea de un caso anterior y pasaría en falso.
    logSpy.info.mockClear();
    vi.stubEnv("FOCUS_DAYS_LEDGER_ENABLED", "true");
    withActivePass();
    const res = await GET(makeRequest(WALLET));
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("counts PRO progress against the configured season", async () => {
    vi.stubEnv("FOCUS_DAYS_LEDGER_ENABLED", "true");
    configuredSeason.id = "21day-mind-challenge-2026-q4";
    mockIsProActive.mockResolvedValue({
      active: true,
      expiresAt: Date.now() + 7 * 86_400_000,
    });
    mockedSupabase.mockReturnValue(buildDbMock(null).supabase);
    mockCountFocusDays.mockResolvedValue(2);

    const json = await (await GET(makeRequest(WALLET))).json();
    expect(json.focusDays).toEqual({
      status: "ok",
      completed: 2,
      goal: 21,
      seasonId: "21day-mind-challenge-2026-q4",
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
      // PRO has no purchased row, so its season is the configured one — the
      // only case where the config is the legitimate source.
      seasonId: "21day-mind-challenge-2026-q3",
      focusDays: { status: "disabled" },
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
