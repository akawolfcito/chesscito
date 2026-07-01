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
vi.mock("@/lib/errors", () => ({
  isUserCancellation: (e: unknown) => Boolean((e as { cancelled?: boolean })?.cancelled),
}));

import { act, renderHook } from "@testing-library/react";
import { useProRail } from "@/lib/pro/use-pro-rail";

const WALLET = "0xaaaabbbbccccddddeeeeffff0000111122223333";
const USDC = "0xcebA9300f2b948710d2653dD7B07f33A8B32118C";
const HASH = `0x${"a".repeat(64)}` as const;

function mockFetch(body: Record<string, unknown>) {
  return vi.fn().mockResolvedValue({ json: () => Promise.resolve(body) });
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS =
    "0x1234567890abcdef1234567890abcdef12345678";
  useAccountMock.mockReturnValue({ address: WALLET });
  useChainIdMock.mockReturnValue(42220);
  writeMock.mockReset();
  writeMock.mockResolvedValue(HASH);
  waitReceiptMock.mockReset();
  waitReceiptMock.mockResolvedValue({ status: "success" });
  vi.stubGlobal(
    "fetch",
    mockFetch({
      ok: true,
      expiresAt: 1_800_000_000_000,
      duplicate: false,
      overpaid: false,
      token: USDC,
      amountPaid: "1990000",
    }),
  );
});
afterEach(() => {
  delete process.env.NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const args = { sku: "chesscito_pro_30" as const, tokenSymbol: "USDC" };

describe("useProRail — availability (fail-closed)", () => {
  it("no treasury → unavailable, pay() never sends", async () => {
    delete process.env.NEXT_PUBLIC_CHESSCITO_TREASURY_ADDRESS;
    const { result } = renderHook(() => useProRail(args));
    expect(result.current.available).toBe(false);
    await act(async () => {
      await result.current.pay();
    });
    expect(writeMock).not.toHaveBeenCalled();
    expect(result.current.phase).toBe("error");
    expect(result.current.errorReason).toBe("unavailable");
  });

  it("wrong chain → unavailable", async () => {
    useChainIdMock.mockReturnValue(1);
    const { result } = renderHook(() => useProRail(args));
    expect(result.current.available).toBe(false);
    await act(async () => {
      await result.current.pay();
    });
    expect(writeMock).not.toHaveBeenCalled();
  });

  it("unsupported token → unavailable", async () => {
    const { result } = renderHook(() => useProRail({ ...args, tokenSymbol: "DAI" }));
    expect(result.current.available).toBe(false);
    await act(async () => {
      await result.current.pay();
    });
    expect(writeMock).not.toHaveBeenCalled();
  });
});

describe("useProRail — happy path", () => {
  it("builds, writes, waits, verifies → success + expiresAt", async () => {
    const { result } = renderHook(() => useProRail(args));
    await act(async () => {
      await result.current.pay();
    });

    expect(writeMock).toHaveBeenCalledTimes(1);
    const call = writeMock.mock.calls[0][0];
    expect(call.functionName).toBe("transfer");
    expect(call.address).toBe(USDC);
    expect(waitReceiptMock).toHaveBeenCalledWith({ hash: HASH });

    expect(result.current.phase).toBe("success");
    expect(result.current.result?.expiresAt).toBe(1_800_000_000_000);
    expect(result.current.result?.duplicate).toBe(false);
    expect(result.current.txHash).toBe(HASH);
    expect(fetch).toHaveBeenCalledWith("/api/verify-payment", expect.any(Object));
  });

  it("never calls approve — direct transfer only", async () => {
    const { result } = renderHook(() => useProRail(args));
    await act(async () => {
      await result.current.pay();
    });
    for (const c of writeMock.mock.calls) {
      expect(c[0].functionName).not.toBe("approve");
      expect(c[0].address).toBe(USDC);
    }
  });
});

describe("useProRail — errors", () => {
  it("verify error (amount_too_low) → error, keeps txHash for re-verify via verifyAgain", async () => {
    vi.stubGlobal("fetch", mockFetch({ ok: false, error: "amount_too_low" }));
    const { result } = renderHook(() => useProRail(args));
    await act(async () => {
      await result.current.pay();
    });
    expect(result.current.phase).toBe("error");
    expect(result.current.errorReason).toBe("amount_too_low");
    expect(result.current.txHash).toBe(HASH);

    vi.stubGlobal(
      "fetch",
      mockFetch({ ok: true, duplicate: true, expiresAt: 1_800_000_000_000, token: USDC, amountPaid: "1990000" }),
    );
    await act(async () => {
      await result.current.verifyAgain();
    });
    expect(result.current.phase).toBe("success");
    expect(result.current.result?.duplicate).toBe(true);
  });

  it("retriable verify error (ledger_write_failed) → auto-retries → success", async () => {
    const okBody = {
      ok: true,
      expiresAt: 1_800_000_000_000,
      duplicate: true,
      token: USDC,
      amountPaid: "1990000",
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ json: () => Promise.resolve({ ok: false, error: "ledger_write_failed" }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve(okBody) });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useProRail({ ...args, retryDelaysMs: [0] }));
    await act(async () => {
      await result.current.pay();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.phase).toBe("success");
  });

  it("write rejected by user → error, no double-write", async () => {
    writeMock.mockReset();
    writeMock.mockRejectedValue({ cancelled: true });
    const { result } = renderHook(() => useProRail(args));
    await act(async () => {
      await result.current.pay();
    });
    expect(writeMock).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe("error");
    expect(result.current.errorReason).toBe("user_rejected");
  });
});
