import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useAccountMock = vi.hoisted(() => vi.fn());
const useChainIdMock = vi.hoisted(() => vi.fn());
const writeMock = vi.hoisted(() => vi.fn());
const waitReceiptMock = vi.hoisted(() => vi.fn());
vi.mock("wagmi", () => ({
  useAccount: useAccountMock,
  useChainId: useChainIdMock,
  usePublicClient: () => ({ waitForTransactionReceipt: waitReceiptMock }),
  useWriteContract: () => ({ writeContractAsync: writeMock }),
}));
// User-rejection detection: treat `{ cancelled: true }` as a reject.
vi.mock("@/lib/errors", () => ({
  isUserCancellation: (e: unknown) => Boolean((e as { cancelled?: boolean })?.cancelled),
}));

import { act, renderHook } from "@testing-library/react";
import { usePaymentRail } from "@/lib/payments/use-payment-rail";

const WALLET = "0xaaaabbbbccccddddeeeeffff0000111122223333";
const USDC = "0xcebA9300f2b948710d2653dD7B07f33A8B32118C";
const HASH = `0x${"a".repeat(64)}` as const;

function mockFetch(body: Record<string, unknown>) {
  return vi.fn().mockResolvedValue({ json: () => Promise.resolve(body) });
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678";
  useAccountMock.mockReturnValue({ address: WALLET });
  useChainIdMock.mockReturnValue(42220);
  writeMock.mockReset();
  writeMock.mockResolvedValue(HASH);
  waitReceiptMock.mockReset();
  waitReceiptMock.mockResolvedValue({ status: "success" });
  vi.stubGlobal("fetch", mockFetch({ ok: true, peonesCredited: 50, duplicate: false, overpaid: false, token: USDC, amountPaid: "500000", newBalance: 60 }));
});
afterEach(() => {
  delete process.env.NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const args = { sku: "peones_pack_50" as const, tokenSymbol: "USDC" };

describe("usePaymentRail — availability (fail-closed)", () => {
  it("no treasury → unavailable, pay() never sends", async () => {
    delete process.env.NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS;
    const { result } = renderHook(() => usePaymentRail(args));
    expect(result.current.available).toBe(false);
    expect(result.current.unavailableReason).toBe("no_treasury");
    await act(async () => { await result.current.pay(); });
    expect(writeMock).not.toHaveBeenCalled();
    expect(result.current.phase).toBe("error");
  });

  it("wrong chain → unavailable", async () => {
    useChainIdMock.mockReturnValue(1);
    const { result } = renderHook(() => usePaymentRail(args));
    expect(result.current.unavailableReason).toBe("wrong_chain");
    await act(async () => { await result.current.pay(); });
    expect(writeMock).not.toHaveBeenCalled();
  });

  it("unsupported token → unavailable", async () => {
    const { result } = renderHook(() => usePaymentRail({ ...args, tokenSymbol: "DAI" }));
    expect(result.current.unavailableReason).toBe("unsupported_token");
    await act(async () => { await result.current.pay(); });
    expect(writeMock).not.toHaveBeenCalled();
  });
});

describe("usePaymentRail — happy path", () => {
  it("builds, writes, waits, verifies → success + 50 Peones", async () => {
    const { result } = renderHook(() => usePaymentRail(args));
    await act(async () => { await result.current.pay(); });

    // Direct ERC20 transfer to the token — no approve, no shop.
    expect(writeMock).toHaveBeenCalledTimes(1);
    const call = writeMock.mock.calls[0][0];
    expect(call.functionName).toBe("transfer");
    expect(call.address).toBe(USDC);
    expect(waitReceiptMock).toHaveBeenCalledWith({ hash: HASH });

    expect(result.current.phase).toBe("success");
    expect(result.current.result?.peonesCredited).toBe(50);
    expect(result.current.result?.duplicate).toBe(false);
    expect(result.current.txHash).toBe(HASH);
  });

  it("duplicate:true → idempotent success (not an error)", async () => {
    vi.stubGlobal("fetch", mockFetch({ ok: true, duplicate: true, peonesCredited: 50, token: USDC, amountPaid: "500000" }));
    const { result } = renderHook(() => usePaymentRail(args));
    await act(async () => { await result.current.pay(); });
    expect(result.current.phase).toBe("success");
    expect(result.current.result?.duplicate).toBe(true);
  });
});

describe("usePaymentRail — errors", () => {
  it("verify error (amount_too_low) → error, keeps txHash for re-verify", async () => {
    vi.stubGlobal("fetch", mockFetch({ ok: false, error: "amount_too_low" }));
    const { result } = renderHook(() => usePaymentRail(args));
    await act(async () => { await result.current.pay(); });
    expect(result.current.phase).toBe("error");
    expect(result.current.errorReason).toBe("amount_too_low");
    expect(result.current.txHash).toBe(HASH); // kept for re-verify

    // Re-verify with a now-successful response → success.
    vi.stubGlobal("fetch", mockFetch({ ok: true, duplicate: true, peonesCredited: 50, token: USDC, amountPaid: "500000" }));
    await act(async () => { await result.current.verifyAgain(); });
    expect(result.current.phase).toBe("success");
    expect(result.current.result?.duplicate).toBe(true);
  });

  it("write rejected by user → error, no double-write", async () => {
    writeMock.mockReset();
    writeMock.mockRejectedValue({ cancelled: true });
    const { result } = renderHook(() => usePaymentRail(args));
    await act(async () => { await result.current.pay(); });
    expect(writeMock).toHaveBeenCalledTimes(1); // not retried
    expect(result.current.phase).toBe("error");
    expect(result.current.errorReason).toBe("user_rejected");
  });

  it("never calls approve and never targets a non-token address", async () => {
    const { result } = renderHook(() => usePaymentRail(args));
    await act(async () => { await result.current.pay(); });
    for (const c of writeMock.mock.calls) {
      expect(c[0].functionName).not.toBe("approve");
      expect(c[0].address).toBe(USDC);
    }
  });
});
