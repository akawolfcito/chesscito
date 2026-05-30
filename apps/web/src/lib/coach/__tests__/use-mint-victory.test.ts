import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useMintVictory } from "../use-mint-victory";

// ── next-intl mock (#118: hook now reads useTranslations for error i18n) ─────
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));

// ── wagmi mocks ───────────────────────────────────────────────────────────────
vi.mock("wagmi", () => ({
  useAccount: () => ({ address: undefined, isConnected: false }),
  useChainId: () => 42220,
  usePublicClient: () => null,
  useReadContracts: () => ({ data: undefined }),
  useWriteContract: () => ({ writeContractAsync: vi.fn() }),
}));

// ── viem mock ─────────────────────────────────────────────────────────────────
vi.mock("viem", async (importOriginal) => {
  const actual = await importOriginal<typeof import("viem")>();
  return {
    ...actual,
    decodeEventLog: vi.fn(() => {
      throw new Error("not our event");
    }),
  };
});

// ── fetch mock (sign-victory endpoint) ────────────────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
  sessionStorage.clear();
  // Default: sign-victory returns a valid payload
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      nonce: "1",
      deadline: String(Math.floor(Date.now() / 1000) + 300),
      signature: ("0x" + "ab".repeat(65)) as `0x${string}`,
    }),
  });
});

describe("useMintVictory", () => {
  const baseInput = {};

  // ── existing stub tests (kept) ─────────────────────────────────────────────

  it("starts in ready phase, empty claimData", () => {
    const { result } = renderHook(() => useMintVictory(baseInput));
    expect(result.current.phase).toBe("ready");
    expect(result.current.data.tokenId).toBeNull();
    expect(result.current.shareStatus).toBe("locked");
    expect(result.current.error).toBeNull();
  });

  it("returned callbacks are referentially stable across re-renders", () => {
    const { result, rerender } = renderHook((p) => useMintVictory(p), {
      initialProps: baseInput,
    });
    const start = result.current.start;
    const reset = result.current.reset;
    rerender(baseInput);
    expect(result.current.start).toBe(start);
    expect(result.current.reset).toBe(reset);
  });

  // ── new tests (T6b) ────────────────────────────────────────────────────────

  it("start with injected sendMint+waitReceipt: ready → claiming → success", async () => {
    const txHash = ("0x" + "ce".repeat(32)) as `0x${string}`;
    const sendApprove = vi.fn().mockResolvedValue(("0x" + "01".repeat(32)) as `0x${string}`);
    const sendMint = vi.fn().mockResolvedValue(txHash);
    const waitReceipt = vi.fn().mockResolvedValue({
      status: "success",
      logs: [
        {
          // Transfer log shape — decodeEventLog will throw (not our event), which is fine
          topics: [
            "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
            "0x0000000000000000000000000000000000000000000000000000000000000000",
            "0x0000000000000000000000001111111111111111111111111111111111111111",
          ],
          data: ("0x" + "01".padStart(64, "0")) as `0x${string}`,
        },
      ],
    });

    // sign-victory fetch succeeds; cache-victory is fire-and-forget
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          nonce: "42",
          deadline: String(Math.floor(Date.now() / 1000) + 300),
          signature: ("0x" + "ab".repeat(65)) as `0x${string}`,
        }),
      })
      .mockResolvedValue({ ok: true, json: async () => ({}) });

    const { result } = renderHook(() =>
      useMintVictory({
        gameId: "550e8400-e29b-41d4-a716-446655440000",
        walletAddress: "0x1111111111111111111111111111111111111111",
        difficulty: "easy",
        result: "win",
        totalMoves: 12,
        elapsedMs: 60_000,
        injected: {
          address: "0x1111111111111111111111111111111111111111",
          chainId: 42220,
          sendApprove,
          sendMint,
          waitReceipt,
        },
      }),
    );

    await act(async () => {
      await result.current.start();
    });

    await waitFor(() =>
      expect(["success", "claiming"]).toContain(result.current.phase),
    );

    expect(sendMint).toHaveBeenCalledTimes(1);
    expect(waitReceipt).toHaveBeenCalledWith(txHash);
  });

  it("sig rejection → cancelled phase + claimingRef released", async () => {
    const sendSig = vi.fn().mockRejectedValue(new Error("user rejected"));

    // Override fetch to reject for sign-victory
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "user rejected" }),
    });

    const { result } = renderHook(() =>
      useMintVictory({
        gameId: "550e8400-e29b-41d4-a716-446655440000",
        walletAddress: "0x1111111111111111111111111111111111111111",
        difficulty: "easy",
        result: "win",
        totalMoves: 12,
        elapsedMs: 60_000,
        injected: {
          address: "0x1111111111111111111111111111111111111111",
          chainId: 42220,
          sendSig,
        },
      }),
    );

    await act(async () => {
      await result.current.start();
    });

    await waitFor(() =>
      expect(["cancelled", "error"]).toContain(result.current.phase),
    );

    // After resolution, reset() must not throw
    expect(() => result.current.reset()).not.toThrow();
  });

  it("reset clears phase + sessionStorage", () => {
    sessionStorage.setItem(
      "chesscito:claim",
      JSON.stringify({ phase: "success" }),
    );

    const { result } = renderHook(() => useMintVictory({}));

    act(() => result.current.reset());

    expect(result.current.phase).toBe("ready");
    expect(sessionStorage.getItem("chesscito:claim")).toBeNull();
  });

  // 2026-05-30: gameId-scoped restore — prevents a saved success from a
  // previous game leaking into the next visor's state (cf. MiniPay smoke
  // bug: Save tile disappeared after phone unlock because the previous
  // game's tokenId hydrated the new game's mint hook).
  it("does NOT restore success when saved gameId differs from input.gameId", () => {
    sessionStorage.setItem(
      "chesscito:claim",
      JSON.stringify({
        phase: "success",
        gameId: "previous-game-id",
        tokenId: "42",
        claimTxHash: "0xabc",
      }),
    );

    const { result } = renderHook(() =>
      useMintVictory({ gameId: "current-game-id" }),
    );

    expect(result.current.phase).toBe("ready");
    expect(result.current.data.tokenId).toBeNull();
    // Stale entry was cleared, not left behind for the next mount.
    expect(sessionStorage.getItem("chesscito:claim")).toBeNull();
  });

  it("does NOT restore legacy success without gameId field", () => {
    sessionStorage.setItem(
      "chesscito:claim",
      JSON.stringify({
        phase: "success",
        tokenId: "42",
        claimTxHash: "0xabc",
      }),
    );

    const { result } = renderHook(() =>
      useMintVictory({ gameId: "some-game-id" }),
    );

    expect(result.current.phase).toBe("ready");
    expect(sessionStorage.getItem("chesscito:claim")).toBeNull();
  });

  it("restores success when saved gameId matches input.gameId", () => {
    sessionStorage.setItem(
      "chesscito:claim",
      JSON.stringify({
        phase: "success",
        gameId: "match-id",
        tokenId: "42",
        claimTxHash: "0xabc",
      }),
    );

    const { result } = renderHook(() =>
      useMintVictory({ gameId: "match-id" }),
    );

    expect(result.current.phase).toBe("success");
    expect(result.current.data.tokenId).toBe(42n);
    expect(result.current.data.claimTxHash).toBe("0xabc");
    expect(result.current.shareStatus).toBe("ready");
  });
});
