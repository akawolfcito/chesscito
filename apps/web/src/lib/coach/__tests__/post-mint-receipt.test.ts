import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const trackMock = vi.fn();
vi.mock("@/lib/telemetry", () => ({
  track: (...args: unknown[]) => trackMock(...args),
}));

import { postMintReceipt } from "../post-mint-receipt";

describe("postMintReceipt", () => {
  const baseArgs = {
    gameId: "550e8400-e29b-41d4-a716-446655440000",
    walletAddress: "0x1111111111111111111111111111111111111111" as const,
    tokenId: "42",
    claimTxHash: ("0x" + "ab".repeat(32)) as `0x${string}`,
    shareCardUrl: "https://chesscito.com/og/42",
    shareLinkUrl: "https://chesscito.com/v/42",
    surface: "coach_viewer" as const,
  };

  beforeEach(() => {
    trackMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs to /api/games/[id]/mint-receipt with the expected body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    await postMintReceipt(baseArgs);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain(`/api/games/${baseArgs.gameId}/mint-receipt`);
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body);
    expect(body).toEqual({
      wallet: baseArgs.walletAddress,
      tokenId: baseArgs.tokenId,
      claimTxHash: baseArgs.claimTxHash,
      shareCardUrl: baseArgs.shareCardUrl,
      shareLinkUrl: baseArgs.shareLinkUrl,
    });
  });

  it("fires telemetry on success with outcome=ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    await postMintReceipt(baseArgs);
    expect(trackMock).toHaveBeenCalledWith("coach_viewer_mint_receipt_write", expect.objectContaining({
      outcome: "ok",
      status_code: 200,
      surface: "coach_viewer",
    }));
  });

  it("fires telemetry on non-ok response with outcome=fail and the status code", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 409 });
    vi.stubGlobal("fetch", fetchMock);
    await postMintReceipt(baseArgs);
    expect(trackMock).toHaveBeenCalledWith("coach_viewer_mint_receipt_write", expect.objectContaining({
      outcome: "fail",
      status_code: 409,
    }));
  });

  it("fires telemetry on network throw with outcome=fail and status_code=0", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network"));
    vi.stubGlobal("fetch", fetchMock);
    await postMintReceipt(baseArgs);
    expect(trackMock).toHaveBeenCalledWith("coach_viewer_mint_receipt_write", expect.objectContaining({
      outcome: "fail",
      status_code: 0,
    }));
  });
});
