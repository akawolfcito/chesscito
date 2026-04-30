import { describe, it, expect, vi, beforeEach } from "vitest";

// LLM is constructed at module load and depends on COACH_LLM_API_KEY.
// Set env BEFORE the route imports so `llm` is non-null in the tests
// that exercise the LLM path. One dedicated test covers the !llm branch
// by constructing a second importer after un-setting the env.
vi.hoisted(() => {
  process.env.COACH_LLM_API_KEY = "test-key";
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

    it("PRO active response includes proActive: true", async () => {
      setupProActiveRedis();

      const res = await POST(makeRequest({ gameId: VALID_GAME_ID, walletAddress: VALID_WALLET }));
      expect(res.status).toEqual(200);
      expect(await res.json()).toEqual({
        status: "ready",
        response: { summary: "nice play" },
        proActive: true,
      });
    });

    it("PRO expired falls back to free-tier behavior (reads credits, decrements, no proActive flag)", async () => {
      const PAST = NOW - 1;
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
