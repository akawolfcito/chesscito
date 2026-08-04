import { describe, expect, it, vi, beforeEach } from "vitest";

const redisGet = vi.hoisted(() => vi.fn());
vi.mock("@upstash/redis", () => ({
  Redis: { fromEnv: () => ({ get: redisGet }) },
}));
vi.mock("@/lib/server/demo-signing", () => ({
  enforceOrigin: vi.fn(),
  getRequestIp: () => "127.0.0.1",
}));
// FAIL-OPEN read — reads one game record and mutates nothing.
vi.mock("@/lib/server/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({
    allowed: true,
    outcome: "allowed",
    resetAt: null,
  })),
}));
vi.mock("@/lib/server/logger", () => ({
  createLogger: () => ({ warn: vi.fn(), error: vi.fn() }),
  hashWallet: (w: string) => `hash(${w})`,
}));

import { GET } from "../route";

describe("GET /api/games/[id]", () => {
  const wallet = "0x1111111111111111111111111111111111111111";
  const gameId = "550e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    redisGet.mockReset();
  });

  it("returns 400 when wallet missing", async () => {
    const req = new Request(`http://localhost/api/games/${gameId}`);
    const res = await GET(req, { params: Promise.resolve({ id: gameId }) });
    expect(res.status).toBe(400);
  });

  it("returns 400 when wallet invalid", async () => {
    const req = new Request(`http://localhost/api/games/${gameId}?wallet=not-an-address`);
    const res = await GET(req, { params: Promise.resolve({ id: gameId }) });
    expect(res.status).toBe(400);
  });

  it("returns 400 when gameId not UUID", async () => {
    const req = new Request(`http://localhost/api/games/garbage?wallet=${wallet}`);
    const res = await GET(req, { params: Promise.resolve({ id: "garbage" }) });
    expect(res.status).toBe(400);
  });

  it("returns 404 on cache miss", async () => {
    redisGet.mockResolvedValue(null);
    const req = new Request(`http://localhost/api/games/${gameId}?wallet=${wallet}`);
    const res = await GET(req, { params: Promise.resolve({ id: gameId }) });
    expect(res.status).toBe(404);
  });

  it("returns 200 with gameRecord on cache hit", async () => {
    const record = {
      gameId,
      moves: ["e4", "e5"],
      result: "win",
      difficulty: "easy",
      totalMoves: 2,
      elapsedMs: 12_000,
      timestamp: Date.now(),
    };
    // Phase 2 (commit 6f98ffd1) made getGameRecord inline a cached
    // analysis from `coach:analysis:<wallet>:<gameId>:<locale>` when
    // present. Scope this assertion to the record-only path by
    // returning null for any analysis key; the analysis-inline contract
    // belongs to a dedicated game-persistence test.
    redisGet.mockImplementation((key: string) =>
      Promise.resolve(key.includes("coach:analysis:") ? null : record),
    );
    const req = new Request(`http://localhost/api/games/${gameId}?wallet=${wallet}`);
    const res = await GET(req, { params: Promise.resolve({ id: gameId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(record);
  });

  it("returns 403 when enforceOrigin rejects", async () => {
    const { enforceOrigin } = await import("@/lib/server/demo-signing");
    (enforceOrigin as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      throw new Error("origin rejected");
    });
    const req = new Request(`http://localhost/api/games/${gameId}?wallet=${wallet}`);
    const res = await GET(req, { params: Promise.resolve({ id: gameId }) });
    expect(res.status).toBe(403);
    (enforceOrigin as ReturnType<typeof vi.fn>).mockReset();
  });
});
