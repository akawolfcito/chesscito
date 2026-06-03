import { describe, expect, it, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useCoachCreditsPurchase } from "../use-coach-credits-purchase";

// Stub wagmi hooks — the hook accepts injected overrides for the real paths,
// but wagmi context is unavailable in unit tests.
vi.mock("wagmi", () => ({
  useAccount: () => ({ address: undefined, isConnected: false }),
  useChainId: () => 42220,
  usePublicClient: () => undefined,
  useWriteContract: () => ({ writeContractAsync: undefined }),
}));

describe("useCoachCreditsPurchase (skeleton)", () => {
  const baseInput = {};

  it("starts idle: not processing, no error", () => {
    const { result } = renderHook(() => useCoachCreditsPurchase(baseInput));
    expect(result.current.isProcessing).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("exposes errorKind=null in initial state", () => {
    const { result } = renderHook(() => useCoachCreditsPurchase(baseInput));
    expect(result.current.errorKind).toBeNull();
  });

  it("buyCredits is referentially stable across re-renders", () => {
    const { result, rerender } = renderHook((p) => useCoachCreditsPurchase(p), { initialProps: baseInput });
    const fn = result.current.buyCredits;
    rerender(baseInput);
    expect(result.current.buyCredits).toBe(fn);
  });
});

describe("useCoachCreditsPurchase (transplanted)", () => {
  const baseInput = {
    walletAddress: "0x1111111111111111111111111111111111111111" as const,
    injected: {
      address: "0x1111111111111111111111111111111111111111" as const,
      chainId: 42220,
    },
  };

  it("buyCredits with injected sendPurchase: ready → processing → success", async () => {
    const sendPurchase = vi.fn().mockResolvedValue("0x" + "ab".repeat(32));
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useCoachCreditsPurchase({
      ...baseInput,
      injected: { ...baseInput.injected, sendPurchase },
      onPurchaseSuccess: onSuccess,
    }));
    await act(async () => { await result.current.buyCredits(3); });
    expect(sendPurchase).toHaveBeenCalled();
    await waitFor(() => expect(result.current.isProcessing).toBe(false));
    expect(result.current.lastTxHash).toMatch(/^0xab/);
    expect(onSuccess).toHaveBeenCalledWith(3, expect.stringMatching(/^0xab/));
  });

  it("buyCredits failure: sets error + processing false", async () => {
    const sendPurchase = vi.fn().mockRejectedValue(new Error("user rejected"));
    const { result } = renderHook(() => useCoachCreditsPurchase({
      ...baseInput,
      injected: { ...baseInput.injected, sendPurchase },
    }));
    await act(async () => { await result.current.buyCredits(3); });
    expect(result.current.error).toBeTruthy();
    expect(result.current.isProcessing).toBe(false);
  });

  it("buyCredits insufficient-funds error: exposes errorKind=insufficientFunds", async () => {
    const sendPurchase = vi.fn().mockRejectedValue(
      new Error("execution reverted: insufficient funds for transfer"),
    );
    const { result } = renderHook(() => useCoachCreditsPurchase({
      ...baseInput,
      injected: { ...baseInput.injected, sendPurchase },
    }));
    await act(async () => { await result.current.buyCredits(3); });
    expect(result.current.error).toBeTruthy();
    expect(result.current.errorKind).toBe("insufficientFunds");
  });
});
