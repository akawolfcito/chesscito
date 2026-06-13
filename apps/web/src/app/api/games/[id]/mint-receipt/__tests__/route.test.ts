import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

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

  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  beforeEach(() => {
    redisGet.mockReset();
    redisSet.mockReset();
    // Share-URL host allowlist mirrors enforceOrigin's env vars. Tests
    // build URLs with chesscito.com host, so pin the allowlist to that
    // host for predictable assertions.
    process.env.NEXT_PUBLIC_APP_URL = "https://chesscito.com";
  });

  afterEach(() => {
    if (originalAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
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
        body: JSON.stringify({ wallet, tokenId: "1", claimTxHash: txHash, shareCardUrl: "https://chesscito.com/og/1", shareLinkUrl: "https://chesscito.com/v/1" }),
      }),
      { params: Promise.resolve({ id: "bad" }) },
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when tokenId not numeric", async () => {
    const res = await POST(makeReq({
      wallet, tokenId: "abc", claimTxHash: txHash,
      shareCardUrl: "https://chesscito.com/og/1", shareLinkUrl: "https://chesscito.com/v/1",
    }), { params: Promise.resolve({ id: gameId }) });
    expect(res.status).toBe(400);
  });

  it("returns 400 when claimTxHash malformed", async () => {
    const res = await POST(makeReq({
      wallet, tokenId: "1", claimTxHash: "0x123",
      shareCardUrl: "https://chesscito.com/og/1", shareLinkUrl: "https://chesscito.com/v/1",
    }), { params: Promise.resolve({ id: gameId }) });
    expect(res.status).toBe(400);
  });

  it("returns 400 when shareCardUrl is not HTTPS", async () => {
    const res = await POST(makeReq({
      wallet, tokenId: "1", claimTxHash: txHash,
      shareCardUrl: "http://insecure.example/og",
      shareLinkUrl: "https://chesscito.com/v/1",
    }), { params: Promise.resolve({ id: gameId }) });
    expect(res.status).toBe(400);
  });

  it("returns 400 when shareLinkUrl is not HTTPS", async () => {
    const res = await POST(makeReq({
      wallet, tokenId: "1", claimTxHash: txHash,
      shareCardUrl: "https://chesscito.com/og/1",
      shareLinkUrl: "http://insecure.example/v/1",
    }), { params: Promise.resolve({ id: gameId }) });
    expect(res.status).toBe(400);
  });

  // Phishing defense (red-team P0-W1): attacker who knows a victim's
  // (wallet, gameId) pair cannot inject an external host into the share
  // URLs. Even HTTPS URLs are rejected unless host is in the allowlist.
  it("returns 400 when shareCardUrl host is outside the allowlist (phishing defense)", async () => {
    const res = await POST(makeReq({
      wallet, tokenId: "1", claimTxHash: txHash,
      shareCardUrl: "https://evil.example.com/phishing-og",
      shareLinkUrl: "https://chesscito.com/v/1",
    }), { params: Promise.resolve({ id: gameId }) });
    expect(res.status).toBe(400);
    expect(redisSet).not.toHaveBeenCalled();
  });

  it("returns 400 when shareLinkUrl host is outside the allowlist (phishing defense)", async () => {
    const res = await POST(makeReq({
      wallet, tokenId: "1", claimTxHash: txHash,
      shareCardUrl: "https://chesscito.com/og/1",
      shareLinkUrl: "https://evil.example.com/phishing-link",
    }), { params: Promise.resolve({ id: gameId }) });
    expect(res.status).toBe(400);
    expect(redisSet).not.toHaveBeenCalled();
  });

  it("returns 400 when shareCardUrl is a lookalike subdomain (chesscit0.com)", async () => {
    const res = await POST(makeReq({
      wallet, tokenId: "1", claimTxHash: txHash,
      shareCardUrl: "https://chesscit0.com/og/1",
      shareLinkUrl: "https://chesscito.com/v/1",
    }), { params: Promise.resolve({ id: gameId }) });
    expect(res.status).toBe(400);
    expect(redisSet).not.toHaveBeenCalled();
  });

  it("accepts a preview.chesscito.com host when NEXT_PUBLIC_PREVIEW_URL is set", async () => {
    process.env.NEXT_PUBLIC_PREVIEW_URL = "https://preview.chesscito.com";
    try {
      redisGet.mockResolvedValue(baseRecord);
      redisSet.mockResolvedValue("OK");
      const res = await POST(makeReq({
        wallet, tokenId: "1", claimTxHash: txHash,
        shareCardUrl: "https://preview.chesscito.com/og/1",
        shareLinkUrl: "https://preview.chesscito.com/v/1",
      }), { params: Promise.resolve({ id: gameId }) });
      expect(res.status).toBe(200);
    } finally {
      delete process.env.NEXT_PUBLIC_PREVIEW_URL;
    }
  });

  it("returns 404 when game record missing", async () => {
    redisGet.mockResolvedValue(null);
    const res = await POST(makeReq({
      wallet, tokenId: "1", claimTxHash: txHash,
      shareCardUrl: "https://chesscito.com/og/1", shareLinkUrl: "https://chesscito.com/v/1",
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
    const [, written, options] = redisSet.mock.calls[0];
    expect(written).toMatchObject({
      gameId, mintedTokenId: "42", claimTxHash: txHash,
      shareCardUrl: "https://chesscito.com/og/42",
      shareLinkUrl: "https://chesscito.com/v/42",
    });
    expect(options).toEqual({ ex: 90 * 24 * 60 * 60 });
  });

  it("is idempotent — same tokenId re-write returns 200 with no write", async () => {
    redisGet.mockResolvedValue({ ...baseRecord, mintedTokenId: "42" });
    const res = await POST(makeReq({
      wallet, tokenId: "42", claimTxHash: txHash,
      shareCardUrl: "https://chesscito.com/og/42", shareLinkUrl: "https://chesscito.com/v/42",
    }), { params: Promise.resolve({ id: gameId }) });
    expect(res.status).toBe(200);
    expect(redisSet).not.toHaveBeenCalled();
  });

  it("re-save with a new tokenId overwrites with the latest (no 409)", async () => {
    const newTxHash = "0x" + "cd".repeat(32);
    redisGet.mockResolvedValue({ ...baseRecord, mintedTokenId: "1", claimTxHash: txHash,
      shareCardUrl: "https://chesscito.com/og/1", shareLinkUrl: "https://chesscito.com/v/1" });
    redisSet.mockResolvedValue("OK");
    const res = await POST(makeReq({
      wallet, tokenId: "2", claimTxHash: newTxHash,
      shareCardUrl: "https://chesscito.com/og/2", shareLinkUrl: "https://chesscito.com/v/2",
    }), { params: Promise.resolve({ id: gameId }) });
    expect(res.status).toBe(200);
    expect(redisSet).toHaveBeenCalledOnce();
    const [, written] = redisSet.mock.calls[0];
    expect(written).toMatchObject({
      gameId, mintedTokenId: "2", claimTxHash: newTxHash,
      shareCardUrl: "https://chesscito.com/og/2", shareLinkUrl: "https://chesscito.com/v/2",
    });
  });

  it("latest-wins re-save does NOT return 409 on tokenId mismatch (unlimited re-save)", async () => {
    redisGet.mockResolvedValue({ ...baseRecord, mintedTokenId: "100" });
    redisSet.mockResolvedValue("OK");
    const res = await POST(makeReq({
      wallet, tokenId: "42", claimTxHash: txHash,
      shareCardUrl: "https://chesscito.com/og/42", shareLinkUrl: "https://chesscito.com/v/42",
    }), { params: Promise.resolve({ id: gameId }) });
    expect(res.status).toBe(200);
  });

  it("returns 403 when enforceOrigin rejects", async () => {
    const { enforceOrigin } = await import("@/lib/server/demo-signing");
    (enforceOrigin as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      throw new Error("origin rejected");
    });
    const res = await POST(makeReq({
      wallet, tokenId: "1", claimTxHash: txHash,
      shareCardUrl: "https://chesscito.com/og/1", shareLinkUrl: "https://chesscito.com/v/1",
    }), { params: Promise.resolve({ id: gameId }) });
    expect(res.status).toBe(403);
    (enforceOrigin as ReturnType<typeof vi.fn>).mockReset();
  });

  it("returns 403 when enforceRateLimit rejects", async () => {
    const { enforceRateLimit } = await import("@/lib/server/demo-signing");
    (enforceRateLimit as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("rate limit exceeded"));
    redisGet.mockResolvedValue(baseRecord);
    const res = await POST(makeReq({
      wallet, tokenId: "1", claimTxHash: txHash,
      shareCardUrl: "https://chesscito.com/og/1", shareLinkUrl: "https://chesscito.com/v/1",
    }), { params: Promise.resolve({ id: gameId }) });
    expect(res.status).toBe(403);
    (enforceRateLimit as ReturnType<typeof vi.fn>).mockReset();
  });
});
