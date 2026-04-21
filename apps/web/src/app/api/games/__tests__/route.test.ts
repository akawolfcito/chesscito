import { describe, it, expect, vi, beforeEach } from "vitest";

const redisMock = vi.hoisted(() => ({
  set: vi.fn(),
  lpush: vi.fn(),
  ltrim: vi.fn(),
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

import { GET, POST } from "../route";
import { enforceOrigin, enforceRateLimit } from "@/lib/server/demo-signing";

const mockedOrigin = vi.mocked(enforceOrigin);
const mockedRate = vi.mocked(enforceRateLimit);

const VALID_WALLET = "0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd";
const VALID_GAME_ID = "11111111-2222-3333-4444-555555555555";

function makePost(body: unknown) {
  return new Request("http://localhost/api/games", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeGet(wallet: string | null) {
  const suffix = wallet === null ? "" : `?wallet=${wallet}`;
  return new Request(`http://localhost/api/games${suffix}`, { method: "GET" });
}

function validGame(overrides: Record<string, unknown> = {}) {
  return {
    gameId: VALID_GAME_ID,
    moves: ["e4", "e5", "Nf3"],
    result: "win",
    difficulty: "easy",
    ...overrides,
  };
}

describe("POST /api/games", () => {
  beforeEach(() => {
    mockedOrigin.mockReset();
    mockedRate.mockReset();
    redisMock.set.mockReset();
    redisMock.lpush.mockReset();
    redisMock.ltrim.mockReset();

    mockedOrigin.mockImplementation(() => {});
    mockedRate.mockResolvedValue(undefined);
    redisMock.set.mockResolvedValue("OK");
    redisMock.lpush.mockResolvedValue(1);
    redisMock.ltrim.mockResolvedValue("OK");
  });

  it("stores the game and returns 200 on valid input", async () => {
    const res = await POST(makePost({ walletAddress: VALID_WALLET, game: validGame() }));
    expect(res.status).toEqual(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(redisMock.set).toHaveBeenCalledWith(
      `coach:game:${VALID_WALLET}:${VALID_GAME_ID}`,
      expect.objectContaining({ gameId: VALID_GAME_ID, totalMoves: 3 }),
      expect.objectContaining({ ex: expect.any(Number) }),
    );
    expect(redisMock.ltrim).toHaveBeenCalledWith(`coach:games:${VALID_WALLET}`, 0, 99);
  });

  it("returns 400 when walletAddress is missing", async () => {
    const res = await POST(makePost({ game: validGame() }));
    expect(res.status).toEqual(400);
  });

  it("returns 400 when game is missing", async () => {
    const res = await POST(makePost({ walletAddress: VALID_WALLET }));
    expect(res.status).toEqual(400);
  });

  it("returns 400 when wallet is malformed", async () => {
    const res = await POST(makePost({ walletAddress: "0xnope", game: validGame() }));
    expect(res.status).toEqual(400);
  });

  it("returns 400 when gameId is not a UUID", async () => {
    const res = await POST(makePost({ walletAddress: VALID_WALLET, game: validGame({ gameId: "not-a-uuid" }) }));
    expect(res.status).toEqual(400);
  });

  it("returns 400 when moves is not an array", async () => {
    const res = await POST(makePost({ walletAddress: VALID_WALLET, game: validGame({ moves: "e4" }) }));
    expect(res.status).toEqual(400);
  });

  it("returns 400 when moves array exceeds MAX_MOVES", async () => {
    const tooMany = Array.from({ length: 501 }, () => "e4");
    const res = await POST(makePost({ walletAddress: VALID_WALLET, game: validGame({ moves: tooMany }) }));
    expect(res.status).toEqual(400);
  });

  it("returns 400 when a move is longer than 10 chars", async () => {
    const res = await POST(makePost({ walletAddress: VALID_WALLET, game: validGame({ moves: ["e4", "waytoolongmove"] }) }));
    expect(res.status).toEqual(400);
  });

  it("returns 500 when enforceOrigin throws", async () => {
    mockedOrigin.mockImplementation(() => { throw new Error("forbidden"); });
    const res = await POST(makePost({ walletAddress: VALID_WALLET, game: validGame() }));
    expect(res.status).toEqual(500);
  });
});

describe("GET /api/games", () => {
  beforeEach(() => {
    mockedOrigin.mockReset();
    mockedRate.mockReset();
    redisMock.lrange.mockReset();
    redisMock.get.mockReset();

    mockedOrigin.mockImplementation(() => {});
    mockedRate.mockResolvedValue(undefined);
  });

  it("returns games list on valid wallet query", async () => {
    redisMock.lrange.mockResolvedValue(["g1", "g2"]);
    redisMock.get.mockImplementation((key: string) =>
      Promise.resolve({ gameId: key.split(":").pop(), moves: [] }),
    );

    const res = await GET(makeGet(VALID_WALLET));
    expect(res.status).toEqual(200);
    const body = (await res.json()) as Array<{ gameId: string }>;
    expect(body).toHaveLength(2);
    expect(body.map((g) => g.gameId)).toEqual(["g1", "g2"]);
  });

  it("drops missing entries (null values filtered)", async () => {
    redisMock.lrange.mockResolvedValue(["g1", "g2"]);
    redisMock.get.mockImplementation((key: string) =>
      key.endsWith("g1") ? Promise.resolve({ gameId: "g1", moves: [] }) : Promise.resolve(null),
    );

    const res = await GET(makeGet(VALID_WALLET));
    const body = (await res.json()) as Array<{ gameId: string }>;
    expect(body).toHaveLength(1);
  });

  it("returns 403 when enforceOrigin rejects", async () => {
    mockedOrigin.mockImplementation(() => { throw new Error("forbidden"); });
    const res = await GET(makeGet(VALID_WALLET));
    expect(res.status).toEqual(403);
  });

  it("returns 400 when wallet is missing", async () => {
    const res = await GET(makeGet(null));
    expect(res.status).toEqual(400);
  });

  it("returns 400 when wallet is malformed", async () => {
    const res = await GET(makeGet("0xnope"));
    expect(res.status).toEqual(400);
  });
});
