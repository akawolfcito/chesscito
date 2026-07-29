/**
 * POST /api/scores/save — session-token write path (Slice 0.1).
 *
 * Audit: docs/product/2026-07-27-score-and-leaders-audit.md §R1, §10.
 *
 * The endpoint no longer verifies a signature per save; it spends one save
 * from a write session (see `session/__tests__/routes.test.ts` for the
 * signature side). What must NOT have regressed is everything Slice 0
 * established: the wallet is never taken from the body, every value is
 * bounded server-side, the surface is checked against the deployment, and an
 * absent Origin buys nothing.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Bound at module load, so it has to be set BEFORE the route is imported:
// `getMergedCatalog` is `unstable_cache(...)` unless this is "1", and
// unstable_cache raises "incrementalCache missing" outside a Next request
// scope. The uncached loader is the same function, and with no CONTENT_STAGE
// floor it serves the compiled baseline with zero DB hits.
vi.hoisted(() => {
  process.env.CONTENT_CACHE_DISABLED = "1";
});

const redisMock = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), eval: vi.fn() }));
vi.mock("@upstash/redis", () => ({ Redis: { fromEnv: () => redisMock } }));

vi.mock("@/lib/server/demo-signing", () => ({
  enforceScoreSaveRateLimit: vi.fn(),
  getRequestIp: vi.fn(() => "127.0.0.1"),
}));

const supabaseMock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: vi.fn(() => supabaseMock),
}));

import { POST } from "../route";
import { enforceScoreSaveRateLimit } from "@/lib/server/demo-signing";
import { getSupabaseServer } from "@/lib/supabase/server";
import { MAX_SCORE_PER_LEVEL } from "@/lib/scores/save-authorization";
import { hashSessionToken } from "@/lib/server/score-session-store";
import { __setLoggerSink, __resetLoggerSink } from "@/lib/server/logger";
import {
  GENERATED_EXERCISES,
  GENERATED_PROMOTION_RUN,
} from "@/lib/game/generated/puzzles.generated";

const mockedRate = vi.mocked(enforceScoreSaveRateLimit);
const mockedSupabase = vi.mocked(getSupabaseServer);

const WALLET_A = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
const WALLET_B = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8";
const TOKEN_A = "a".repeat(64);
const TOKEN_B = "b".repeat(64);

type Session = {
  wallet: string;
  surface: "learn" | "play";
  maxSaves: number;
  usedSaves: number;
  expired?: boolean;
  revoked?: boolean;
};

/** Sessions keyed by token HASH — the endpoint must never look one up by raw
 *  token, and this makes that observable. Mirrors the SQL predicates,
 *  including that `used_saves < max_saves` is evaluated at consume time. */
function installSessions(entries: Record<string, Session>) {
  const byHash = new Map<string, Session>();
  for (const [token, s] of Object.entries(entries)) {
    byHash.set(hashSessionToken(token), { ...s });
  }

  // In-memory mirror of `save_score_attempt` (20260731000000_score_attempts).
  // Slice 3 moved the consume INSIDE the RPC, so the endpoint makes exactly one
  // call and the budget, the replay and the ordinal are all decided in there.
  // This simulator keeps the same order the SQL does — resolve, surface,
  // replay, consume, save, insert — because the endpoint's behaviour depends on
  // that order and a mock that reordered it would test a function nobody wrote.
  const attempts = new Map<string, Record<string, unknown>>();
  const ordinals = new Map<string, number>();
  const scoreSaves = new Set<string>();

  supabaseMock.rpc.mockImplementation((fn: string, args: Record<string, unknown>) => {
    if (fn !== "save_score_attempt") throw new Error(`unexpected rpc ${fn}`);
    const s = byHash.get(args.p_token_hash as string);
    if (!s) {
      return Promise.resolve({
        data: { status: "session_error", sessionStatus: "not_found" },
        error: null,
      });
    }
    const sessionError = (sessionStatus: string) =>
      Promise.resolve({
        data: { status: "session_error", sessionStatus, wallet: s.wallet },
        error: null,
      });

    if (s.revoked) return sessionError("revoked");
    if (s.expired) return sessionError("expired");
    if (s.surface !== args.p_deployment_surface) {
      return Promise.resolve({
        data: { status: "invalid", reason: "surface_mismatch", wallet: s.wallet },
        error: null,
      });
    }

    const attemptKey = `${s.wallet}:${args.p_attempt_id}`;
    const stored = attempts.get(attemptKey);
    if (stored) {
      // A replay consumes ZERO and serves the stored row.
      return Promise.resolve({
        data: {
          status: stored.saveStatus,
          mode: "free",
          freeUsed: scoreSaves.size,
          scoreSaveId: stored.saveId,
          wallet: s.wallet,
          attempt: {
            attemptId: args.p_attempt_id,
            attemptIndex: stored.attemptIndex,
            replayed: true,
            starsEarned: stored.starsEarned,
            gradeStatus: stored.gradeStatus,
          },
        },
        error: null,
      });
    }

    if (s.usedSaves >= s.maxSaves) return sessionError("exhausted");
    s.usedSaves += 1;

    const saveId = `${s.wallet}:${args.p_level_id}:${args.p_score}`.toLowerCase();
    const saveStatus = scoreSaves.has(saveId) ? "duplicate" : "saved";
    scoreSaves.add(saveId);

    const ordinalKey = `${s.wallet}:${s.surface}:${args.p_level_id}`;
    const attemptIndex = (ordinals.get(ordinalKey) ?? 0) + 1;
    ordinals.set(ordinalKey, attemptIndex);

    attempts.set(attemptKey, {
      saveStatus,
      saveId,
      attemptIndex,
      starsEarned: args.p_stars_earned ?? null,
      gradeStatus: args.p_grade_status,
    });

    return Promise.resolve({
      data: {
        status: saveStatus,
        mode: "free",
        freeUsed: scoreSaves.size,
        scoreSaveId: saveId,
        wallet: s.wallet,
        attempt: {
          attemptId: args.p_attempt_id,
          attemptIndex,
          replayed: false,
          starsEarned: args.p_stars_earned ?? null,
          gradeStatus: args.p_grade_status,
        },
      },
      error: null,
    });
  });

  return byHash;
}

function makeRequest(
  body: unknown,
  token: string | null = TOKEN_A,
  headers: Record<string, string> = { origin: "http://localhost:3000" },
) {
  const h: Record<string, string> = { "content-type": "application/json", ...headers };
  if (token) h.authorization = `Bearer ${token}`;
  return new Request("http://localhost/api/scores/save", {
    method: "POST",
    headers: h,
    body: JSON.stringify(body),
  });
}

const VALID_BODY = { levelId: 1, score: 1200, timeMs: 5000 };

describe("POST /api/scores/save — session token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __setLoggerSink(() => {});
    process.env.NEXT_PUBLIC_CHESSCITO_MODE = "learn";
    mockedRate.mockResolvedValue(undefined);
    mockedSupabase.mockReturnValue(supabaseMock as never);
    installSessions({
      [TOKEN_A]: { wallet: WALLET_A, surface: "learn", maxSaves: 25, usedSaves: 0 },
    });
  });

  afterEach(() => {
    __resetLoggerSink();
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  // ── 9: the happy path ────────────────────────────────────────────────────

  it("saves under a valid token", async () => {
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ status: "saved", mode: "free" });
    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      "save_score_attempt",
      expect.objectContaining({
        p_level_id: 1,
        p_score: 1200,
        p_deployment_surface: "learn",
      }),
    );
  });

  it("makes exactly ONE call — the consume moved inside the transaction", async () => {
    // Slice 3. It used to be two round trips (consume, then save), which meant
    // a failure in between spent a unit for a row that was never written.
    await POST(makeRequest(VALID_BODY));
    expect(supabaseMock.rpc).toHaveBeenCalledTimes(1);
    expect(supabaseMock.rpc).not.toHaveBeenCalledWith(
      "consume_score_write_session",
      expect.anything(),
    );
  });

  it("looks the session up by token HASH, never by the raw token", async () => {
    await POST(makeRequest(VALID_BODY));
    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      "save_score_attempt",
      expect.objectContaining({ p_token_hash: hashSessionToken(TOKEN_A) }),
    );
    const args = supabaseMock.rpc.mock.calls[0][1] as Record<string, unknown>;
    expect(Object.values(args)).not.toContain(TOKEN_A);
  });

  // ── 10: the wallet comes from the token ──────────────────────────────────

  it("sends NO wallet at all — identity comes out of the session row", async () => {
    // Stronger than it used to be. The endpoint no longer passes a wallet the
    // RPC could have taken on trust: "a token writing to another wallet" is
    // not a check that could be forgotten, it is a value that does not exist.
    await POST(makeRequest({ ...VALID_BODY, player: WALLET_B, wallet: WALLET_B }));
    const args = supabaseMock.rpc.mock.calls[0][1] as Record<string, unknown>;
    for (const key of Object.keys(args)) {
      expect(key).not.toMatch(/wallet/i);
    }
    expect(Object.values(args)).not.toContain(WALLET_B);
  });

  it("writes to wallet B under B's token, with the same body", async () => {
    installSessions({
      [TOKEN_B]: { wallet: WALLET_B, surface: "learn", maxSaves: 25, usedSaves: 0 },
    });
    const res = await POST(makeRequest(VALID_BODY, TOKEN_B));
    await expect(res.json()).resolves.toMatchObject({
      quota: { wallet: WALLET_B },
    });
  });

  // ── 11–13: token state ───────────────────────────────────────────────────

  it("rejects a request with no token", async () => {
    const res = await POST(makeRequest(VALID_BODY, null));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ reason: "missing_session" });
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it("rejects a malformed Authorization header without touching the DB", async () => {
    const res = await POST(makeRequest(VALID_BODY, "not-a-token"));
    expect(res.status).toBe(401);
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it("rejects an unknown token", async () => {
    const res = await POST(makeRequest(VALID_BODY, "c".repeat(64)));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ reason: "invalid_session" });
  });

  it("rejects an expired token", async () => {
    installSessions({
      [TOKEN_A]: {
        wallet: WALLET_A, surface: "learn", maxSaves: 25, usedSaves: 0, expired: true,
      },
    });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ reason: "session_expired" });
  });

  it("rejects a revoked token", async () => {
    installSessions({
      [TOKEN_A]: {
        wallet: WALLET_A, surface: "learn", maxSaves: 25, usedSaves: 0, revoked: true,
      },
    });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ reason: "session_revoked" });
  });

  it("rejects a token minted on the other product", async () => {
    installSessions({
      [TOKEN_A]: { wallet: WALLET_A, surface: "play", maxSaves: 25, usedSaves: 0 },
    });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ reason: "surface_mismatch" });
  });

  // ── 14: the budget ───────────────────────────────────────────────────────

  it("spends exactly one save per request", async () => {
    const sessions = installSessions({
      [TOKEN_A]: { wallet: WALLET_A, surface: "learn", maxSaves: 3, usedSaves: 0 },
    });
    await POST(makeRequest(VALID_BODY));
    await POST(makeRequest(VALID_BODY));
    expect(sessions.get(hashSessionToken(TOKEN_A))!.usedSaves).toBe(2);
  });

  it("refuses the save that would cross maxSaves", async () => {
    installSessions({
      [TOKEN_A]: { wallet: WALLET_A, surface: "learn", maxSaves: 2, usedSaves: 2 },
    });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({ reason: "session_exhausted" });
  });

  it("never writes a score once the budget is spent", async () => {
    installSessions({
      [TOKEN_A]: { wallet: WALLET_A, surface: "learn", maxSaves: 1, usedSaves: 0 },
    });
    await POST(makeRequest(VALID_BODY));
    supabaseMock.rpc.mockClear();
    const res = await POST(makeRequest({ ...VALID_BODY, score: 1500 }));
    expect(res.status).toBe(409);
    // The RPC is still called — it is the thing that decides `exhausted` —
    // but it writes nothing and spends nothing, which is the property that
    // matters and the one the SQL smoke proves against a real Postgres.
    await expect(res.json()).resolves.toMatchObject({ reason: "session_exhausted" });
  });

  it("does not exceed the budget under concurrent requests", async () => {
    const sessions = installSessions({
      [TOKEN_A]: { wallet: WALLET_A, surface: "learn", maxSaves: 3, usedSaves: 0 },
    });
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        POST(makeRequest({ ...VALID_BODY, score: 1000 + i })),
      ),
    );
    const ok = results.filter((r) => r.status === 200).length;
    const refused = results.filter((r) => r.status === 409).length;
    expect(ok).toBe(3);
    expect(refused).toBe(5);
    expect(sessions.get(hashSessionToken(TOKEN_A))!.usedSaves).toBe(3);
  });

  // ── 15, 22: bounds survive ───────────────────────────────────────────────

  it("rejects a score above the per-level ceiling even with a valid token", async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, score: MAX_SCORE_PER_LEVEL + 1 }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ reason: "score_out_of_range" });
    // Bounds run BEFORE the spend: a rejected value must not cost a save.
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it("accepts a score exactly at the ceiling", async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, score: MAX_SCORE_PER_LEVEL }));
    expect(res.status).toBe(200);
    expect(MAX_SCORE_PER_LEVEL * 6).toBeLessThan(2_147_483_647);
  });

  it.each([
    ["out-of-range level", { levelId: 9 }],
    ["NaN score", { score: Number.NaN }],
    ["negative score", { score: -100 }],
    ["Infinity score", { score: Number.POSITIVE_INFINITY }],
    ["fractional score", { score: 12.5 }],
    ["string score", { score: "1200" }],
    ["zero time", { timeMs: 0 }],
  ])("rejects %s", async (_label, over) => {
    const res = await POST(makeRequest({ ...VALID_BODY, ...over }));
    expect(res.status).toBe(400);
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  // ── origin ───────────────────────────────────────────────────────────────

  it("still requires a token when Origin and Referer are absent", async () => {
    const res = await POST(makeRequest(VALID_BODY, null, {}));
    expect(res.status).toBe(401);
  });

  it("accepts a header-less request that carries a valid token", async () => {
    // Proves the rejection above was about the token, not the headers —
    // MiniPay's WebView must keep working.
    const res = await POST(makeRequest(VALID_BODY, TOKEN_A, {}));
    expect(res.status).toBe(200);
  });

  it("rejects a mismatched origin outright", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://learn.chesscito.xyz";
    const res = await POST(makeRequest(VALID_BODY, TOKEN_A, { origin: "https://evil.example" }));
    expect(res.status).toBe(403);
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  // ── infrastructure ───────────────────────────────────────────────────────

  it("returns 429 when the limiter trips, before any DB work", async () => {
    mockedRate.mockRejectedValue(new Error("Rate limit exceeded"));
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(429);
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it("returns 503 rather than a false 'saved' when Supabase is unconfigured", async () => {
    mockedSupabase.mockReturnValue(null as never);
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(503);
  });

  it("fails closed when the session store is unreachable", async () => {
    supabaseMock.rpc.mockResolvedValue({ data: null, error: { code: "08006" } });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(503);
  });

  it("never touches the on-chain lane", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await POST(makeRequest(VALID_BODY));
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

/**
 * Slice 3 etapa 4B — attempt identity and server-side grading.
 *
 * The catalogue here is the REAL one. `getMergedCatalog()` is not mocked, and
 * with no CONTENT_STAGE floor it serves the compiled baseline with zero DB
 * hits — so the ids below are the ids that ship, and a fixture id that does
 * not exist would be indistinguishable from a grader that stopped working.
 */
describe("POST /api/scores/save — attempt identity + grading", () => {
  /** A real level from a bucket, with the level id its piece maps to. */
  function firstLevel(pool: Record<string, { id: string; optimalMoves: number }[]>) {
    const pieces = ["rook", "bishop", "knight", "pawn", "queen", "king"] as const;
    for (let i = 0; i < pieces.length; i++) {
      const level = pool[pieces[i]]?.[0];
      if (level) return { level, levelId: i + 1 };
    }
    throw new Error("pool has no shipped level");
  }

  const exercise = firstLevel(GENERATED_EXERCISES);
  const promotionRun = firstLevel(GENERATED_PROMOTION_RUN);

  // The sink receives a JSON LINE, and the event name is `msg`. Reading it as
  // an object with an `event` field silently produced `[""]` for every line,
  // which passes a `.toContain` on nothing and fails on everything.
  let logs: { event: string; fields: Record<string, unknown> }[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    logs = [];
    __setLoggerSink((line) => {
      const record = JSON.parse(line) as Record<string, unknown>;
      logs.push({ event: String(record.msg ?? ""), fields: record });
    });
    process.env.NEXT_PUBLIC_CHESSCITO_MODE = "learn";
    delete process.env.CONTENT_STAGE;
    mockedRate.mockResolvedValue(undefined);
    mockedSupabase.mockReturnValue(supabaseMock as never);
    installSessions({
      [TOKEN_A]: { wallet: WALLET_A, surface: "learn", maxSaves: 100, usedSaves: 0 },
    });
  });

  afterEach(() => {
    __resetLoggerSink();
  });

  const attemptBody = (over: Record<string, unknown> = {}) => ({
    levelId: exercise.levelId,
    score: 1200,
    timeMs: 5000,
    attemptId: "0".repeat(32),
    exerciseId: exercise.level.id,
    measurement: { kind: "moves", movesUsed: exercise.level.optimalMoves },
    ...over,
  });

  const rpcArgs = () =>
    supabaseMock.rpc.mock.calls[0][1] as Record<string, unknown>;

  it("grades the measurement server-side and sends the RESULT to the RPC", async () => {
    const res = await POST(makeRequest(attemptBody()));
    expect(res.status).toBe(200);
    // The optimum earns three stars from computeStars — computed here, on the
    // server, from a raw move count.
    expect(rpcArgs()).toMatchObject({
      p_exercise_id: exercise.level.id,
      p_measure_kind: "moves",
      p_measure_value: exercise.level.optimalMoves,
      p_measure_ceiling: null,
      p_grade_status: "graded",
      p_stars_earned: 3,
    });
    await expect(res.json()).resolves.toMatchObject({
      attempt: { replayed: false, starsEarned: 3, gradeStatus: "graded" },
    });
  });

  it("IGNORES a starsEarned sent by the client", async () => {
    // D12, stated as a test rather than a comment. A stolen token buys row
    // count on its own wallet; it must not buy stars.
    await POST(
      makeRequest(
        attemptBody({
          starsEarned: 3,
          // Two over the optimum: in range, and worth exactly one star.
          measurement: { kind: "moves", movesUsed: exercise.level.optimalMoves + 2 },
        }),
      ),
    );
    // Graded from the measurement, not from the body.
    expect(rpcArgs().p_stars_earned).toBe(1);
  });

  it("rejects an exercise id the catalogue does not carry", async () => {
    const res = await POST(makeRequest(attemptBody({ exerciseId: "rook-3" })));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ reason: "unknown_exercise" });
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it("rejects a measurement of the wrong kind for the bucket", async () => {
    // A move count on a Promotion Run id. Both are numbers; only the bucket
    // knows this one grades failures.
    const res = await POST(
      makeRequest(
        attemptBody({
          levelId: promotionRun.levelId,
          exerciseId: promotionRun.level.id,
          measurement: { kind: "moves", movesUsed: 4 },
        }),
      ),
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      reason: "measurement_kind_mismatch",
    });
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it("rejects a level id that is not the catalogue's for that exercise", async () => {
    const wrong = exercise.levelId === 1 ? 2 : 1;
    const res = await POST(makeRequest(attemptBody({ levelId: wrong })));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ reason: "level_mismatch" });
  });

  it("rejects an out-of-range measurement", async () => {
    const res = await POST(
      makeRequest(attemptBody({ measurement: { kind: "moves", movesUsed: 0 } })),
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      reason: "measurement_out_of_range",
    });
  });

  it("rejects a malformed measurement without reaching the grader", async () => {
    const res = await POST(
      makeRequest(attemptBody({ measurement: { kind: "vibes", n: 1 } })),
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ reason: "invalid_measurement" });
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it("records an attempt with NULLs when the bundle sent nothing to grade", async () => {
    // B15 + compatibility: a bundle older than this deploy sends neither an
    // exerciseId nor a measurement. That is genuinely unknown — NULL columns
    // and `ungraded` — never a sentinel like 0 stars or an empty string.
    const res = await POST(
      makeRequest({ levelId: 1, score: 1200, timeMs: 5000, attemptId: "0".repeat(32) }),
    );
    expect(res.status).toBe(200);
    expect(rpcArgs()).toMatchObject({
      p_exercise_id: null,
      p_measure_kind: null,
      p_measure_value: null,
      p_measure_ceiling: null,
      p_grade_status: "ungraded",
      p_stars_earned: null,
    });
  });

  it("mints an attempt id when the body carries none, and says so", async () => {
    // B14. This is what makes the deploy order safe: migration + endpoint can
    // ship before the bundle that mints ids.
    const res = await POST(makeRequest({ levelId: 1, score: 1200, timeMs: 5000 }));
    expect(res.status).toBe(200);
    expect(rpcArgs().p_attempt_id).toMatch(/^[0-9a-f]{32}$/);
    expect(rpcArgs().p_attempt_id_source).toBe("server");
    expect(logs.map((l) => l.event)).toContain("score_attempt_id_absent");
  });

  it("marks a client-supplied id as client-sourced", async () => {
    await POST(makeRequest(attemptBody()));
    expect(rpcArgs().p_attempt_id_source).toBe("client");
    expect(rpcArgs().p_attempt_id).toBe("0".repeat(32));
  });

  it("rejects a malformed attempt id rather than quietly re-minting it", async () => {
    // Discarding an id the client believes it has would turn a retry into a
    // second attempt.
    const res = await POST(makeRequest(attemptBody({ attemptId: "nope" })));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ reason: "invalid_attempt_id" });
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it("answers a repeated attempt id as a replay that spends nothing", async () => {
    const sessions = installSessions({
      [TOKEN_A]: { wallet: WALLET_A, surface: "learn", maxSaves: 100, usedSaves: 0 },
    });
    await POST(makeRequest(attemptBody()));
    const res = await POST(makeRequest(attemptBody()));

    await expect(res.json()).resolves.toMatchObject({
      attempt: { replayed: true, attemptIndex: 1 },
    });
    expect(sessions.get(hashSessionToken(TOKEN_A))!.usedSaves).toBe(1);
    expect(logs.map((l) => l.event)).toContain("score_attempt_replayed");
  });

  it("records the attempt even when the score did not move", async () => {
    // Every carril-2 completion looks like this: the cumulative score is
    // unchanged, so score_saves answers `duplicate` — and the attempt is still
    // recorded, which is the entire point of the table.
    await POST(makeRequest(attemptBody({ attemptId: "1".repeat(32) })));
    const res = await POST(makeRequest(attemptBody({ attemptId: "2".repeat(32) })));
    await expect(res.json()).resolves.toMatchObject({
      status: "duplicate",
      attempt: { replayed: false, attemptIndex: 2 },
    });
  });

  it("keeps the wallet hash on the surface-mismatch log line", async () => {
    installSessions({
      [TOKEN_A]: { wallet: WALLET_A, surface: "play", maxSaves: 100, usedSaves: 0 },
    });
    const res = await POST(makeRequest(attemptBody()));
    expect(res.status).toBe(400);
    const line = logs.find((l) => l.event === "score_save_surface_mismatch");
    expect(line, "the surface mismatch stopped being logged").toBeDefined();
    expect(line!.fields.wallet).toBeTruthy();
    expect(line!.fields.wallet).not.toBe(WALLET_A);
  });
});
