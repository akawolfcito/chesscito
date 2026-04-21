import { describe, it, expect, vi, beforeEach } from "vitest";

const redisMock = vi.hoisted(() => ({
  lrange: vi.fn(),
  get: vi.fn(),
}));
vi.mock("@upstash/redis", () => ({
  Redis: { fromEnv: () => redisMock },
}));

vi.mock("@/lib/server/demo-signing", () => ({
  enforceOrigin: vi.fn(),
  enforceRateLimit: vi.fn(),
  getRequestIp: vi.fn(() => "127.0.0.1"),
}));

import { GET } from "../route";
import { enforceOrigin, enforceRateLimit } from "@/lib/server/demo-signing";

const mockedOrigin = vi.mocked(enforceOrigin);
const mockedRate = vi.mocked(enforceRateLimit);

const VALID_WALLET = "0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd";

function makeRequest(wallet: string | null) {
  const suffix = wallet === null ? "" : `?wallet=${wallet}`;
  return new Request(`http://localhost/api/coach/history${suffix}`, { method: "GET" });
}

function makeAnalysis(gameId: string) {
  return {
    gameId,
    provider: "server",
    model: "gpt-4o-mini",
    analysisVersion: "1.0.0",
    createdAt: 1_700_000_000_000,
    response: { summary: `analysis for ${gameId}` },
  };
}

function makeGame(gameId: string) {
  return {
    gameId,
    moves: ["e4", "e5"],
    result: "win",
    difficulty: "easy",
    totalMoves: 2,
    receivedAt: 1_700_000_000_000,
  };
}

describe("GET /api/coach/history", () => {
  beforeEach(() => {
    mockedOrigin.mockReset();
    mockedRate.mockReset();
    redisMock.lrange.mockReset();
    redisMock.get.mockReset();

    mockedOrigin.mockImplementation(() => {});
    mockedRate.mockResolvedValue(undefined);
  });

  it("returns paired analysis+game records (status 200)", async () => {
    redisMock.lrange.mockResolvedValue(["g1", "g2"]);
    redisMock.get.mockImplementation((key: string) => {
      if (key.includes("analysis:")) return Promise.resolve(makeAnalysis(key.split(":").pop()!));
      if (key.includes("game:")) return Promise.resolve(makeGame(key.split(":").pop()!));
      return Promise.resolve(null);
    });

    const res = await GET(makeRequest(VALID_WALLET));
    expect(res.status).toEqual(200);
    const body = (await res.json()) as Array<{ gameId: string }>;
    expect(body).toHaveLength(2);
    expect(body.map((e) => e.gameId)).toEqual(["g1", "g2"]);
  });

  it("drops entries when either analysis or game is missing", async () => {
    redisMock.lrange.mockResolvedValue(["g1", "g2"]);
    redisMock.get.mockImplementation((key: string) => {
      if (key === `coach:analysis:${VALID_WALLET}:g1`) return Promise.resolve(makeAnalysis("g1"));
      if (key === `coach:game:${VALID_WALLET}:g1`) return Promise.resolve(makeGame("g1"));
      // g2: analysis missing
      return Promise.resolve(null);
    });

    const res = await GET(makeRequest(VALID_WALLET));
    const body = (await res.json()) as Array<{ gameId: string }>;
    expect(body).toHaveLength(1);
    expect(body[0].gameId).toEqual("g1");
  });

  it("returns an empty list when the analysisList is empty", async () => {
    redisMock.lrange.mockResolvedValue([]);
    const res = await GET(makeRequest(VALID_WALLET));
    expect(res.status).toEqual(200);
    expect(await res.json()).toEqual([]);
  });

  it("caps results at 20 entries (lrange 0..19)", async () => {
    redisMock.lrange.mockResolvedValue([]);
    await GET(makeRequest(VALID_WALLET));
    expect(redisMock.lrange).toHaveBeenCalledWith(`coach:analyses:${VALID_WALLET}`, 0, 19);
  });

  it("returns 403 when enforceOrigin rejects", async () => {
    mockedOrigin.mockImplementation(() => { throw new Error("Forbidden"); });
    const res = await GET(makeRequest(VALID_WALLET));
    expect(res.status).toEqual(403);
  });

  it("returns 403 when rate limit is exceeded", async () => {
    mockedRate.mockRejectedValue(new Error("Rate limit"));
    const res = await GET(makeRequest(VALID_WALLET));
    expect(res.status).toEqual(403);
  });

  it("returns 400 when the wallet query param is missing", async () => {
    const res = await GET(makeRequest(null));
    expect(res.status).toEqual(400);
  });

  it("returns 400 when the wallet address is malformed", async () => {
    const res = await GET(makeRequest("0xnope"));
    expect(res.status).toEqual(400);
  });
});
