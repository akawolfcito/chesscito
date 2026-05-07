import { describe, it, expect, vi, beforeEach } from "vitest";

// LLM is constructed at module load and depends on COACH_LLM_API_KEY.
// Set env BEFORE the route imports so `llm` is non-null in the tests
// that exercise the LLM path. One dedicated test covers the !llm branch
// by constructing a second importer after un-setting the env.
vi.hoisted(() => {
  process.env.COACH_LLM_API_KEY = "test-key";
  process.env.LOG_SALT = "test-salt-route";
});

const redisMock = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  eval: vi.fn(),
  lpush: vi.fn(),
  decr: vi.fn(),
  del: vi.fn(),
}));
vi.mock("@upstash/redis", () => ({
  Redis: { fromEnv: () => redisMock },
}));

const openaiCreate = vi.hoisted(() => vi.fn());
vi.mock("openai", () => ({
  default: class OpenAI {
    chat = { completions: { create: openaiCreate } };
    constructor() {}
  },
}));

vi.mock("@/lib/server/demo-signing", () => ({
  enforceOrigin: vi.fn(),
  enforceRateLimit: vi.fn(),
  getRequestIp: vi.fn(() => "127.0.0.1"),
}));

const validateMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/coach/validate-game", () => ({
  validateGameRecord: validateMock,
}));

const normalizeMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/coach/normalize", () => ({
  normalizeCoachResponse: normalizeMock,
}));

vi.mock("@/lib/coach/prompt-template", () => ({
  buildCoachPrompt: () => "test prompt",
}));

const aggregateHistoryMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/coach/history-digest", () => ({
  aggregateHistory: aggregateHistoryMock,
}));

const backfillMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/coach/backfill", () => ({
  backfillRedisToSupabase: backfillMock,
}));

const isProActiveMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/pro/is-active", () => ({
  isProActive: isProActiveMock,
}));

const persistAnalysisMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/coach/persistence", () => ({
  persistAnalysis: persistAnalysisMock,
}));

import { POST } from "../route";
import { enforceOrigin, enforceRateLimit } from "@/lib/server/demo-signing";

const mockedOrigin = vi.mocked(enforceOrigin);
const mockedRate = vi.mocked(enforceRateLimit);

const VALID_WALLET = "0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd";
const VALID_GAME_ID = "11111111-2222-3333-4444-555555555555";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/coach/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function setupHappyPathRedis() {
  redisMock.get.mockImplementation((key: string) => {
    if (key === `coach:analysis:${VALID_WALLET}:${VALID_GAME_ID}`) return Promise.resolve(null);
    if (key === `coach:job-ref:${VALID_WALLET}:${VALID_GAME_ID}`) return Promise.resolve(null);
    if (key === `coach:pending:${VALID_WALLET}`) return Promise.resolve(null);
    if (key === `coach:credits:${VALID_WALLET}`) return Promise.resolve(5);
    if (key === `coach:game:${VALID_WALLET}:${VALID_GAME_ID}`) {
      return Promise.resolve({
        gameId: VALID_GAME_ID,
        moves: ["e4", "e5"],
        result: "win",
        difficulty: "easy",
        totalMoves: 2,
      });
    }
    if (key === `coach:summary:${VALID_WALLET}`) return Promise.resolve(null);
    return Promise.resolve(null);
  });
}

describe("POST /api/coach/analyze", () => {
  beforeEach(() => {
    mockedOrigin.mockReset();
    mockedRate.mockReset();
    redisMock.get.mockReset();
    redisMock.set.mockReset();
    redisMock.eval.mockReset();
    redisMock.lpush.mockReset();
    redisMock.decr.mockReset();
    redisMock.del.mockReset();
    openaiCreate.mockReset();
    validateMock.mockReset();
    normalizeMock.mockReset();

    mockedOrigin.mockImplementation(() => {});
    mockedRate.mockResolvedValue(undefined);
    redisMock.set.mockResolvedValue("OK");
    redisMock.eval.mockResolvedValue(1);
    redisMock.lpush.mockResolvedValue(1);
    redisMock.decr.mockResolvedValue(4);
    redisMock.del.mockResolvedValue(1);
    validateMock.mockReturnValue({ valid: true, computedResult: "win" });
    normalizeMock.mockReturnValue({ success: true, data: { summary: "nice play" } });

    aggregateHistoryMock.mockReset();
    backfillMock.mockReset();
    isProActiveMock.mockReset();
    persistAnalysisMock.mockReset();
    persistAnalysisMock.mockResolvedValue({});

    // Free-tier default — overridden per-test for PRO branches.
    isProActiveMock.mockResolvedValue({ active: false });
    aggregateHistoryMock.mockResolvedValue(null);
    backfillMock.mockResolvedValue({ copied: 0, waited: false });
  });

  it("returns {status:ready,response} on the happy LLM path", async () => {
    setupHappyPathRedis();
    openaiCreate.mockResolvedValue({
      choices: [{ message: { content: '{"summary":"nice play"}' } }],
    });

    const res = await POST(makeRequest({ gameId: VALID_GAME_ID, walletAddress: VALID_WALLET }));
    expect(res.status).toEqual(200);
    expect(await res.json()).toEqual({ status: "ready", response: { summary: "nice play" } });
    expect(redisMock.decr).toHaveBeenCalledWith(`coach:credits:${VALID_WALLET}`);
  });

  it("short-circuits with the cached analysis when one already exists", async () => {
    const cached = {
      gameId: VALID_GAME_ID,
      response: { summary: "cached" },
    };
    redisMock.get.mockImplementation((key: string) => {
      if (key === `coach:analysis:${VALID_WALLET}:${VALID_GAME_ID}`) return Promise.resolve(cached);
      return Promise.resolve(null);
    });

    const res = await POST(makeRequest({ gameId: VALID_GAME_ID, walletAddress: VALID_WALLET }));
    expect(res.status).toEqual(200);
    expect(await res.json()).toEqual({ status: "ready", response: { summary: "cached" } });
    expect(openaiCreate).not.toHaveBeenCalled();
  });

  it("returns the existing jobId when a job for this game is already pending", async () => {
    redisMock.get.mockImplementation((key: string) => {
      if (key === `coach:analysis:${VALID_WALLET}:${VALID_GAME_ID}`) return Promise.resolve(null);
      if (key === `coach:job-ref:${VALID_WALLET}:${VALID_GAME_ID}`) return Promise.resolve("job-xyz");
      return Promise.resolve(null);
    });

    const res = await POST(makeRequest({ gameId: VALID_GAME_ID, walletAddress: VALID_WALLET }));
    expect(res.status).toEqual(200);
    expect(await res.json()).toEqual({ jobId: "job-xyz" });
    expect(openaiCreate).not.toHaveBeenCalled();
  });

  it("returns 429 when a different pending job exists for the wallet", async () => {
    redisMock.get.mockImplementation((key: string) => {
      if (key === `coach:analysis:${VALID_WALLET}:${VALID_GAME_ID}`) return Promise.resolve(null);
      if (key === `coach:job-ref:${VALID_WALLET}:${VALID_GAME_ID}`) return Promise.resolve(null);
      if (key === `coach:pending:${VALID_WALLET}`) return Promise.resolve("other-job");
      return Promise.resolve(null);
    });

    const res = await POST(makeRequest({ gameId: VALID_GAME_ID, walletAddress: VALID_WALLET }));
    expect(res.status).toEqual(429);
  });

  it("returns 402 when the wallet has no credits", async () => {
    redisMock.get.mockImplementation((key: string) => {
      if (key === `coach:credits:${VALID_WALLET}`) return Promise.resolve(0);
      return Promise.resolve(null);
    });

    const res = await POST(makeRequest({ gameId: VALID_GAME_ID, walletAddress: VALID_WALLET }));
    expect(res.status).toEqual(402);
  });

  it("returns 404 when the game record is not found", async () => {
    redisMock.get.mockImplementation((key: string) => {
      if (key === `coach:credits:${VALID_WALLET}`) return Promise.resolve(5);
      return Promise.resolve(null);
    });

    const res = await POST(makeRequest({ gameId: VALID_GAME_ID, walletAddress: VALID_WALLET }));
    expect(res.status).toEqual(404);
  });

  it("returns 400 when validateGameRecord rejects", async () => {
    setupHappyPathRedis();
    validateMock.mockReturnValue({ valid: false, error: "impossible move" });

    const res = await POST(makeRequest({ gameId: VALID_GAME_ID, walletAddress: VALID_WALLET }));
    expect(res.status).toEqual(400);
  });

  it("returns 502 when the LLM response has no JSON object", async () => {
    setupHappyPathRedis();
    openaiCreate.mockResolvedValue({
      choices: [{ message: { content: "no json here" } }],
    });

    const res = await POST(makeRequest({ gameId: VALID_GAME_ID, walletAddress: VALID_WALLET }));
    expect(res.status).toEqual(502);
    expect(redisMock.del).toHaveBeenCalledWith(`coach:pending:${VALID_WALLET}`);
  });

  it("returns 502 when normalization fails", async () => {
    setupHappyPathRedis();
    openaiCreate.mockResolvedValue({
      choices: [{ message: { content: '{"bad":"payload"}' } }],
    });
    normalizeMock.mockReturnValue({ success: false, error: "missing summary" });

    const res = await POST(makeRequest({ gameId: VALID_GAME_ID, walletAddress: VALID_WALLET }));
    expect(res.status).toEqual(502);
  });

  it("returns 400 when the gameId is not a UUID", async () => {
    const res = await POST(makeRequest({ gameId: "not-uuid", walletAddress: VALID_WALLET }));
    expect(res.status).toEqual(400);
  });

  it("returns 400 when the wallet is malformed", async () => {
    const res = await POST(makeRequest({ gameId: VALID_GAME_ID, walletAddress: "0xnope" }));
    expect(res.status).toEqual(400);
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toEqual(400);
  });

  it("returns 500 when enforceOrigin throws", async () => {
    mockedOrigin.mockImplementation(() => { throw new Error("forbidden"); });
    const res = await POST(makeRequest({ gameId: VALID_GAME_ID, walletAddress: VALID_WALLET }));
    expect(res.status).toEqual(500);
  });

  describe("Chesscito PRO bypass", () => {
    const PRO_KEY = `coach:pro:${VALID_WALLET}`;
    const NOW = 1_700_000_000_000;
    const FUTURE = NOW + 5 * 24 * 60 * 60 * 1000;

    function setupProActiveRedis(opts: { credits?: number | null } = {}) {
      const visited: string[] = [];
      redisMock.get.mockImplementation((key: string) => {
        visited.push(key);
        if (key === `coach:analysis:${VALID_WALLET}:${VALID_GAME_ID}`) return Promise.resolve(null);
        if (key === `coach:job-ref:${VALID_WALLET}:${VALID_GAME_ID}`) return Promise.resolve(null);
        if (key === `coach:pending:${VALID_WALLET}`) return Promise.resolve(null);
        if (key === PRO_KEY) return Promise.resolve(String(FUTURE));
        if (key === `coach:credits:${VALID_WALLET}`) return Promise.resolve(opts.credits ?? null);
        if (key === `coach:game:${VALID_WALLET}:${VALID_GAME_ID}`) {
          return Promise.resolve({
            gameId: VALID_GAME_ID,
            moves: ["e4", "e5"],
            result: "win",
            difficulty: "easy",
          });
        }
        if (key === `coach:summary:${VALID_WALLET}`) return Promise.resolve(null);
        return Promise.resolve(null);
      });
      return visited;
    }

    beforeEach(() => {
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      openaiCreate.mockResolvedValue({
        choices: [{ message: { content: '{"summary":"nice play"}' } }],
      });
      // The route now consults `isProActive` (mocked at module scope) for
      // its bypass decision rather than reading the PRO key directly via
      // redis.get. Per-spec PRO branches set this resolved value.
      isProActiveMock.mockResolvedValue({ active: true, expiresAt: FUTURE });
    });

    it("PRO active + credits=0 still succeeds (real bypass)", async () => {
      setupProActiveRedis({ credits: 0 });

      const res = await POST(makeRequest({ gameId: VALID_GAME_ID, walletAddress: VALID_WALLET }));
      expect(res.status).toEqual(200);
      const body = await res.json();
      expect(body.status).toEqual("ready");
    });

    it("PRO active never reads coach:credits and never decrements", async () => {
      const visited = setupProActiveRedis({ credits: 0 });

      const res = await POST(makeRequest({ gameId: VALID_GAME_ID, walletAddress: VALID_WALLET }));
      expect(res.status).toEqual(200);
      // Regression guard: the credit balance key must NEVER be queried
      // when PRO is active — proves the bypass took the early branch.
      expect(visited).not.toContain(`coach:credits:${VALID_WALLET}`);
      expect(redisMock.decr).not.toHaveBeenCalled();
    });

    it("PRO active emits a coach_pro_bypass_used console.info (server-side telemetry)", async () => {
      setupProActiveRedis();
      const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

      const res = await POST(makeRequest({ gameId: VALID_GAME_ID, walletAddress: VALID_WALLET }));
      expect(res.status).toEqual(200);

      expect(infoSpy).toHaveBeenCalledWith(
        "[pro-bypass] coach analyze short-circuited",
        expect.objectContaining({
          event: "coach_pro_bypass_used",
          pro_expires_at: FUTURE,
        }),
      );
      // No PII smoke check: the call must not include the wallet.
      const payload = infoSpy.mock.calls[0]?.[1] as Record<string, unknown> | undefined;
      expect(payload).toBeDefined();
      expect(JSON.stringify(payload)).not.toContain(VALID_WALLET);

      infoSpy.mockRestore();
    });

    it("PRO inactive does not emit the coach_pro_bypass_used log", async () => {
      const PAST = NOW - 1;
      isProActiveMock.mockResolvedValue({ active: false, expiresAt: PAST });
      redisMock.get.mockImplementation((key: string) => {
        if (key === `coach:analysis:${VALID_WALLET}:${VALID_GAME_ID}`) return Promise.resolve(null);
        if (key === `coach:job-ref:${VALID_WALLET}:${VALID_GAME_ID}`) return Promise.resolve(null);
        if (key === `coach:pending:${VALID_WALLET}`) return Promise.resolve(null);
        if (key === PRO_KEY) return Promise.resolve(String(PAST));
        if (key === `coach:credits:${VALID_WALLET}`) return Promise.resolve(5);
        if (key === `coach:game:${VALID_WALLET}:${VALID_GAME_ID}`) {
          return Promise.resolve({
            gameId: VALID_GAME_ID,
            moves: ["e4", "e5"],
            result: "win",
            difficulty: "easy",
          });
        }
        return Promise.resolve(null);
      });
      const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

      const res = await POST(makeRequest({ gameId: VALID_GAME_ID, walletAddress: VALID_WALLET }));
      expect(res.status).toEqual(200);
      expect(infoSpy).not.toHaveBeenCalledWith(
        "[pro-bypass] coach analyze short-circuited",
        expect.anything(),
      );

      infoSpy.mockRestore();
    });

    it("PRO active response includes proActive: true", async () => {
      setupProActiveRedis();

      const res = await POST(makeRequest({ gameId: VALID_GAME_ID, walletAddress: VALID_WALLET }));
      expect(res.status).toEqual(200);
      // The PRO success payload also carries historyMeta from the read
      // path (Task 6 §6.4); the proActive flag is the focus of this spec.
      expect(await res.json()).toEqual({
        status: "ready",
        response: { summary: "nice play" },
        proActive: true,
        historyMeta: { gamesPlayed: 0 },
      });
    });

    it("PRO expired falls back to free-tier behavior (reads credits, decrements, no proActive flag)", async () => {
      const PAST = NOW - 1;
      isProActiveMock.mockResolvedValue({ active: false, expiresAt: PAST });
      const visited: string[] = [];
      redisMock.get.mockImplementation((key: string) => {
        visited.push(key);
        if (key === `coach:analysis:${VALID_WALLET}:${VALID_GAME_ID}`) return Promise.resolve(null);
        if (key === `coach:job-ref:${VALID_WALLET}:${VALID_GAME_ID}`) return Promise.resolve(null);
        if (key === `coach:pending:${VALID_WALLET}`) return Promise.resolve(null);
        if (key === PRO_KEY) return Promise.resolve(String(PAST));
        if (key === `coach:credits:${VALID_WALLET}`) return Promise.resolve(5);
        if (key === `coach:game:${VALID_WALLET}:${VALID_GAME_ID}`) {
          return Promise.resolve({
            gameId: VALID_GAME_ID,
            moves: ["e4", "e5"],
            result: "win",
            difficulty: "easy",
          });
        }
        return Promise.resolve(null);
      });

      const res = await POST(makeRequest({ gameId: VALID_GAME_ID, walletAddress: VALID_WALLET }));
      expect(res.status).toEqual(200);
      const body = await res.json();
      expect(body.proActive).toBeUndefined();
      expect(visited).toContain(`coach:credits:${VALID_WALLET}`);
      expect(redisMock.decr).toHaveBeenCalledWith(`coach:credits:${VALID_WALLET}`);
    });
  });
});

// Shared reset for the sibling describes below (the legacy outer
// describe owns its own beforeEach; these blocks are top-level so we
// re-stamp the per-test mock baseline here).
function resetSiblingMocks() {
  mockedOrigin.mockReset();
  mockedRate.mockReset();
  redisMock.get.mockReset();
  redisMock.set.mockReset();
  redisMock.eval.mockReset();
  redisMock.lpush.mockReset();
  redisMock.decr.mockReset();
  redisMock.del.mockReset();
  openaiCreate.mockReset();
  validateMock.mockReset();
  normalizeMock.mockReset();
  aggregateHistoryMock.mockReset();
  backfillMock.mockReset();
  isProActiveMock.mockReset();
  persistAnalysisMock.mockReset();
  persistAnalysisMock.mockResolvedValue({});

  mockedOrigin.mockImplementation(() => {});
  mockedRate.mockResolvedValue(undefined);
  redisMock.set.mockResolvedValue("OK");
  redisMock.eval.mockResolvedValue(1);
  redisMock.lpush.mockResolvedValue(1);
  redisMock.decr.mockResolvedValue(4);
  redisMock.del.mockResolvedValue(1);
  validateMock.mockReturnValue({ valid: true, computedResult: "win" });
  normalizeMock.mockReturnValue({ success: true, data: { summary: "nice play" } });
  aggregateHistoryMock.mockResolvedValue(null);
  backfillMock.mockResolvedValue({ copied: 0, waited: false });
}

describe("POST /api/coach/analyze — PRO read path", () => {
  beforeEach(() => {
    resetSiblingMocks();
    isProActiveMock.mockResolvedValue({ active: true, expiresAt: 9999999999999 });
  });

  it("calls backfill + aggregateHistory exactly once for PRO", async () => {
    setupHappyPathRedis();
    aggregateHistoryMock.mockResolvedValue({
      gamesPlayed: 8,
      recentResults: { win: 3, lose: 4, draw: 1, resigned: 0 },
      topWeaknessTags: [{ tag: "weak-king-safety", count: 3 }],
    });
    openaiCreate.mockResolvedValue({
      choices: [{ message: { content: '{"summary":"nice play"}' } }],
    });

    const res = await POST(makeRequest({ gameId: VALID_GAME_ID, walletAddress: VALID_WALLET }));
    expect(res.status).toEqual(200);
    expect(backfillMock).toHaveBeenCalledTimes(1);
    expect(backfillMock).toHaveBeenCalledWith(VALID_WALLET, expect.anything());
    expect(aggregateHistoryMock).toHaveBeenCalledTimes(1);
    expect(aggregateHistoryMock).toHaveBeenCalledWith(VALID_WALLET);
  });

  it("includes historyMeta with gamesPlayed in the PRO response", async () => {
    setupHappyPathRedis();
    aggregateHistoryMock.mockResolvedValue({
      gamesPlayed: 12,
      recentResults: { win: 4, lose: 6, draw: 2, resigned: 0 },
      topWeaknessTags: [],
    });
    openaiCreate.mockResolvedValue({
      choices: [{ message: { content: '{"summary":"nice play"}' } }],
    });

    const res = await POST(makeRequest({ gameId: VALID_GAME_ID, walletAddress: VALID_WALLET }));
    const body = await res.json();
    expect(body).toMatchObject({ status: "ready", proActive: true, historyMeta: { gamesPlayed: 12 } });
  });

  it("includes historyMeta with gamesPlayed=0 when aggregateHistory returns null", async () => {
    setupHappyPathRedis();
    aggregateHistoryMock.mockResolvedValue(null);
    openaiCreate.mockResolvedValue({
      choices: [{ message: { content: '{"summary":"nice play"}' } }],
    });

    const res = await POST(makeRequest({ gameId: VALID_GAME_ID, walletAddress: VALID_WALLET }));
    const body = await res.json();
    expect(body.historyMeta).toEqual({ gamesPlayed: 0 });
  });

  it("falls back gracefully when backfill throws — analysis still returns 200", async () => {
    setupHappyPathRedis();
    backfillMock.mockRejectedValue(new Error("supabase blew up"));
    aggregateHistoryMock.mockResolvedValue(null);
    openaiCreate.mockResolvedValue({
      choices: [{ message: { content: '{"summary":"ok"}' } }],
    });

    const res = await POST(makeRequest({ gameId: VALID_GAME_ID, walletAddress: VALID_WALLET }));
    expect(res.status).toEqual(200);
    const body = await res.json();
    expect(body.historyMeta).toEqual({ gamesPlayed: 0 });
  });
});

describe("POST /api/coach/analyze — Free read path (regression guard)", () => {
  beforeEach(() => {
    resetSiblingMocks();
    isProActiveMock.mockResolvedValue({ active: false });
  });

  it("does NOT call backfill or aggregateHistory for free users", async () => {
    setupHappyPathRedis();
    openaiCreate.mockResolvedValue({
      choices: [{ message: { content: '{"summary":"nice play"}' } }],
    });

    const res = await POST(makeRequest({ gameId: VALID_GAME_ID, walletAddress: VALID_WALLET }));
    expect(res.status).toEqual(200);
    expect(backfillMock).not.toHaveBeenCalled();
    expect(aggregateHistoryMock).not.toHaveBeenCalled();
  });

  it("free response does NOT include historyMeta or proActive", async () => {
    setupHappyPathRedis();
    openaiCreate.mockResolvedValue({
      choices: [{ message: { content: '{"summary":"nice play"}' } }],
    });

    const res = await POST(makeRequest({ gameId: VALID_GAME_ID, walletAddress: VALID_WALLET }));
    const body = await res.json();
    expect(body.historyMeta).toBeUndefined();
    expect(body.proActive).toBeUndefined();
  });
});

describe("POST /api/coach/analyze — PRO write path", () => {
  beforeEach(() => {
    resetSiblingMocks();
    isProActiveMock.mockResolvedValue({ active: true, expiresAt: 9999999999999 });
    aggregateHistoryMock.mockResolvedValue(null);
    backfillMock.mockResolvedValue({ copied: 0, waited: false });
  });

  it("calls persistAnalysis exactly once on PRO success with full response", async () => {
    setupHappyPathRedis();
    openaiCreate.mockResolvedValue({
      choices: [{ message: { content: '{"summary":"nice play"}' } }],
    });
    normalizeMock.mockReturnValue({
      success: true,
      data: { kind: "full", summary: "nice play", mistakes: [], lessons: [], praise: [] },
    });

    const res = await POST(makeRequest({ gameId: VALID_GAME_ID, walletAddress: VALID_WALLET }));
    expect(res.status).toEqual(200);
    expect(persistAnalysisMock).toHaveBeenCalledTimes(1);
    expect(persistAnalysisMock).toHaveBeenCalledWith(
      VALID_WALLET,
      expect.objectContaining({
        gameId: VALID_GAME_ID,
        difficulty: "easy",
        result: "win",
        totalMoves: expect.any(Number),
        response: expect.objectContaining({ kind: "full" }),
      }),
    );
  });

  it("does NOT call persistAnalysis when proActive=false (free)", async () => {
    isProActiveMock.mockResolvedValue({ active: false });
    setupHappyPathRedis();
    openaiCreate.mockResolvedValue({
      choices: [{ message: { content: '{"summary":"nice play"}' } }],
    });
    normalizeMock.mockReturnValue({
      success: true,
      data: { kind: "full", summary: "nice play", mistakes: [], lessons: [], praise: [] },
    });

    const res = await POST(makeRequest({ gameId: VALID_GAME_ID, walletAddress: VALID_WALLET }));
    expect(res.status).toEqual(200);
    expect(persistAnalysisMock).not.toHaveBeenCalled();
  });

  it("returns 200 even when persistAnalysis throws (fail-soft)", async () => {
    setupHappyPathRedis();
    persistAnalysisMock.mockRejectedValue(new Error("supabase write blew up"));
    openaiCreate.mockResolvedValue({
      choices: [{ message: { content: '{"summary":"nice play"}' } }],
    });
    normalizeMock.mockReturnValue({
      success: true,
      data: { kind: "full", summary: "nice play", mistakes: [], lessons: [], praise: [] },
    });

    const res = await POST(makeRequest({ gameId: VALID_GAME_ID, walletAddress: VALID_WALLET }));
    expect(res.status).toEqual(200); // user got their analysis
  });

  it("does NOT call persistAnalysis when response.kind is 'quick' (BasicCoachResponse)", async () => {
    setupHappyPathRedis();
    openaiCreate.mockResolvedValue({
      choices: [{ message: { content: '{"summary":"x"}' } }],
    });
    normalizeMock.mockReturnValue({
      success: true,
      data: { kind: "quick", summary: "x", tips: [] },
    });

    const res = await POST(makeRequest({ gameId: VALID_GAME_ID, walletAddress: VALID_WALLET }));
    expect(res.status).toEqual(200);
    expect(persistAnalysisMock).not.toHaveBeenCalled();
  });
});
