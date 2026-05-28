import { describe, expect, it, vi, beforeEach } from "vitest";

const { redisGet, redisSet } = vi.hoisted(() => ({
  redisGet: vi.fn(),
  redisSet: vi.fn(),
}));
vi.mock("@upstash/redis", () => ({
  Redis: { fromEnv: () => ({ get: redisGet, set: redisSet }) },
}));
vi.mock("@/lib/server/demo-signing", () => ({
  enforceOrigin: vi.fn(),
  enforceRateLimit: vi.fn(),
  getRequestIp: () => "127.0.0.1",
}));
vi.mock("@/lib/server/logger", () => ({
  createLogger: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
  hashWallet: (w: string) => `hash(${w})`,
}));

import { POST } from "../route";

describe("POST /api/games/[id]/mint-receipt", () => {
  const wallet = "0x1111111111111111111111111111111111111111";
  const gameId = "550e8400-e29b-41d4-a716-446655440000";
  const txHash = "0x" + "ab".repeat(32);
  const baseRecord = {
    gameId, moves: ["e4"], result: "win", difficulty: "easy",
    totalMoves: 1, elapsedMs: 5000, timestamp: 1_700_000_000_000,
  };

  beforeEach(() => {
    redisGet.mockReset();
    redisSet.mockReset();
  });

  function makeReq(body: unknown) {
    return new Request(`http://localhost/api/games/${gameId}/mint-receipt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("returns 400 when wallet missing", async () => {
    const res = await POST(makeReq({ tokenId: "1" }), { params: Promise.resolve({ id: gameId }) });
    expect(res.status).toBe(400);
  });

  it("returns 400 when gameId not UUID", async () => {
    const res = await POST(
      new Request("http://localhost/api/games/bad/mint-receipt", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, tokenId: "1", claimTxHash: txHash, shareCardUrl: "https://x", shareLinkUrl: "https://y" }),
      }),
      { params: Promise.resolve({ id: "bad" }) },
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when tokenId not numeric", async () => {
    const res = await POST(makeReq({
      wallet, tokenId: "abc", claimTxHash: txHash,
      shareCardUrl: "https://x", shareLinkUrl: "https://y",
    }), { params: Promise.resolve({ id: gameId }) });
    expect(res.status).toBe(400);
  });

  it("returns 400 when claimTxHash malformed", async () => {
    const res = await POST(makeReq({
      wallet, tokenId: "1", claimTxHash: "0x123",
      shareCardUrl: "https://x", shareLinkUrl: "https://y",
    }), { params: Promise.resolve({ id: gameId }) });
    expect(res.status).toBe(400);
  });

  it("returns 404 when game record missing", async () => {
    redisGet.mockResolvedValue(null);
    const res = await POST(makeReq({
      wallet, tokenId: "1", claimTxHash: txHash,
      shareCardUrl: "https://x", shareLinkUrl: "https://y",
    }), { params: Promise.resolve({ id: gameId }) });
    expect(res.status).toBe(404);
  });

  it("writes mint fields on first call (200)", async () => {
    redisGet.mockResolvedValue(baseRecord);
    redisSet.mockResolvedValue("OK");
    const res = await POST(makeReq({
      wallet, tokenId: "42", claimTxHash: txHash,
      shareCardUrl: "https://chesscito.com/og/42",
      shareLinkUrl: "https://chesscito.com/v/42",
    }), { params: Promise.resolve({ id: gameId }) });
    expect(res.status).toBe(200);
    expect(redisSet).toHaveBeenCalledOnce();
    const [, written] = redisSet.mock.calls[0];
    expect(written).toMatchObject({
      gameId, mintedTokenId: "42", claimTxHash: txHash,
      shareCardUrl: "https://chesscito.com/og/42",
      shareLinkUrl: "https://chesscito.com/v/42",
    });
  });

  it("is idempotent — same tokenId re-write returns 200 with no write", async () => {
    redisGet.mockResolvedValue({ ...baseRecord, mintedTokenId: "42" });
    const res = await POST(makeReq({
      wallet, tokenId: "42", claimTxHash: txHash,
      shareCardUrl: "https://x", shareLinkUrl: "https://y",
    }), { params: Promise.resolve({ id: gameId }) });
    expect(res.status).toBe(200);
    expect(redisSet).not.toHaveBeenCalled();
  });

  it("returns 409 on tokenId mismatch (record already has a DIFFERENT tokenId)", async () => {
    redisGet.mockResolvedValue({ ...baseRecord, mintedTokenId: "100" });
    const res = await POST(makeReq({
      wallet, tokenId: "42", claimTxHash: txHash,
      shareCardUrl: "https://x", shareLinkUrl: "https://y",
    }), { params: Promise.resolve({ id: gameId }) });
    expect(res.status).toBe(409);
  });

  it("returns 403 when enforceOrigin rejects", async () => {
    const { enforceOrigin } = await import("@/lib/server/demo-signing");
    (enforceOrigin as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      throw new Error("origin rejected");
    });
    const res = await POST(makeReq({
      wallet, tokenId: "1", claimTxHash: txHash,
      shareCardUrl: "https://x", shareLinkUrl: "https://y",
    }), { params: Promise.resolve({ id: gameId }) });
    expect(res.status).toBe(403);
    (enforceOrigin as ReturnType<typeof vi.fn>).mockReset();
  });
});
