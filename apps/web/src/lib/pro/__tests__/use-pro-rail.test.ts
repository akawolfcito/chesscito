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

/**
 * A double tap on "Unlock PRO" signs two independent transfers. Server-side
 * idempotency cannot undo that: both keys in `/api/verify-payment`
 * (`REDIS_KEYS.proProcessedTx` and `consume_pro_treasury_payment`'s
 * `${source}:${chainId}:${txHash}:${logIndex}`) are per-tx-hash, so two
 * genuine transfers settle as two distinct payments — the wallet is charged
 * twice and PRO is extended twice. The mutex is the only layer that can stop
 * the second transfer from ever being requested.
 */
describe("useProRail — single-flight mutex", () => {
  function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }

  it("synchronous double tap → one transfer requested, one verify", async () => {
    const fetchMock = mockFetch({
      ok: true,
      expiresAt: 1_800_000_000_000,
      duplicate: false,
      overpaid: false,
      token: USDC,
      amountPaid: "1990000",
    });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useProRail(args));

    await act(async () => {
      await Promise.all([result.current.pay(), result.current.pay()]);
    });

    expect(writeMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe("success");
  });

  it("second tap while the signature is pending → ignored", async () => {
    const signature = deferred<`0x${string}`>();
    writeMock.mockReset();
    writeMock.mockReturnValue(signature.promise);
    const { result } = renderHook(() => useProRail(args));

    let first!: Promise<void>;
    await act(async () => {
      first = result.current.pay();
      await Promise.resolve();
    });
    expect(result.current.phase).toBe("awaiting_signature");

    // The wallet sheet is open; the user taps the CTA again.
    await act(async () => {
      await result.current.pay();
    });
    expect(writeMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      signature.resolve(HASH);
      await first;
    });
    expect(writeMock).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe("success");
  });

  it("reset() while in flight does not unlock a second transfer", async () => {
    const signature = deferred<`0x${string}`>();
    writeMock.mockReset();
    writeMock.mockReturnValue(signature.promise);
    const { result } = renderHook(() => useProRail(args));

    let first!: Promise<void>;
    await act(async () => {
      first = result.current.pay();
      await Promise.resolve();
    });

    await act(async () => {
      result.current.reset();
    });
    expect(result.current.phase).toBe("awaiting_signature");

    await act(async () => {
      await result.current.pay();
    });
    expect(writeMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      signature.resolve(HASH);
      await first;
    });
  });

  it("releases after a user rejection → an intentional retry still works", async () => {
    writeMock.mockReset();
    writeMock.mockRejectedValueOnce({ cancelled: true }).mockResolvedValueOnce(HASH);
    const { result } = renderHook(() => useProRail(args));

    await act(async () => {
      await result.current.pay();
    });
    expect(result.current.errorReason).toBe("user_rejected");

    await act(async () => {
      await result.current.pay();
    });
    expect(writeMock).toHaveBeenCalledTimes(2);
    expect(result.current.phase).toBe("success");
  });

  it("releases after an unavailable/not-connected bail-out", async () => {
    useAccountMock.mockReturnValue({ address: undefined });
    const { result, rerender } = renderHook(() => useProRail(args));
    await act(async () => {
      await result.current.pay();
    });
    expect(result.current.errorReason).toBe("not_connected");

    useAccountMock.mockReturnValue({ address: WALLET });
    rerender();
    await act(async () => {
      await result.current.pay();
    });
    expect(writeMock).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe("success");
  });

  it("releases after a verify error → verifyAgain is still reachable", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ json: () => Promise.resolve({ ok: false, error: "bad_receipt" }) })
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            ok: true,
            expiresAt: 1_800_000_000_000,
            duplicate: true,
            token: USDC,
            amountPaid: "1990000",
          }),
      });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useProRail({ ...args, retryDelaysMs: [] }));

    await act(async () => {
      await result.current.pay();
    });
    expect(result.current.phase).toBe("error");

    await act(async () => {
      await result.current.verifyAgain();
    });
    expect(result.current.phase).toBe("success");
    // The settled transfer is verified again, never re-sent.
    expect(writeMock).toHaveBeenCalledTimes(1);
  });
});

/**
 * The mutex protects the MONEY. It never protected the MEASUREMENT: the sheet
 * emitted `pro_purchase_started` before calling `pay()`, so two taps in the
 * same tick produced two "started" events against one transfer and inflated
 * the denominator of PRO conversion.
 *
 * The fix is an acceptance hook: `pay()` invokes `onAccepted` immediately
 * after claiming the mutex, so the event describes an attempt the rail took,
 * not a finger touching glass. It fires BEFORE any await, so a funnel still
 * sees "started" ahead of "confirmed".
 */
describe("useProRail — accepted-attempt hook", () => {
  it("calls onAccepted once per accepted attempt", async () => {
    const fetchMock = mockFetch({
      ok: true,
      expiresAt: 1_800_000_000_000,
      duplicate: false,
      overpaid: false,
      token: USDC,
      amountPaid: "1990000",
    });
    vi.stubGlobal("fetch", fetchMock);
    const onAccepted = vi.fn();
    const { result } = renderHook(() => useProRail(args));

    await act(async () => {
      await result.current.pay({ onAccepted });
    });

    expect(onAccepted).toHaveBeenCalledTimes(1);
  });

  it("synchronous double tap → ONE onAccepted, matching the one transfer", async () => {
    const fetchMock = mockFetch({
      ok: true,
      expiresAt: 1_800_000_000_000,
      duplicate: false,
      overpaid: false,
      token: USDC,
      amountPaid: "1990000",
    });
    vi.stubGlobal("fetch", fetchMock);
    const onAccepted = vi.fn();
    const { result } = renderHook(() => useProRail(args));

    await act(async () => {
      await Promise.all([
        result.current.pay({ onAccepted }),
        result.current.pay({ onAccepted }),
      ]);
    });

    expect(onAccepted).toHaveBeenCalledTimes(1);
    expect(writeMock).toHaveBeenCalledTimes(1);
  });

  /** A rejected wallet is an attempt the rail ACCEPTED and that then failed.
   *  It must count once, and the retry after it must count again — otherwise
   *  the fix trades an inflated numerator for a suppressed one. */
  it("a rejected attempt still counts, and the retry counts again", async () => {
    const onAccepted = vi.fn();
    writeMock.mockReset();
    writeMock.mockRejectedValueOnce(new Error("User rejected the request"));
    const { result } = renderHook(() => useProRail(args));

    await act(async () => {
      await result.current.pay({ onAccepted });
    });
    expect(onAccepted).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe("error");

    const fetchMock = mockFetch({
      ok: true,
      expiresAt: 1_800_000_000_000,
      duplicate: false,
      overpaid: false,
      token: USDC,
      amountPaid: "1990000",
    });
    vi.stubGlobal("fetch", fetchMock);
    writeMock.mockResolvedValueOnce(HASH);

    await act(async () => {
      await result.current.pay({ onAccepted });
    });
    expect(onAccepted).toHaveBeenCalledTimes(2);
  });

  /** The tap that the mutex swallows must leave no trace in analytics. */
  it("does not call onAccepted for a tap while the signature is pending", async () => {
    const signature = deferred2<`0x${string}`>();
    const onAccepted = vi.fn();
    writeMock.mockReset();
    writeMock.mockReturnValue(signature.promise);
    const { result } = renderHook(() => useProRail(args));

    let first!: Promise<void>;
    await act(async () => {
      first = result.current.pay({ onAccepted });
      await Promise.resolve();
    });
    expect(onAccepted).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.pay({ onAccepted });
    });
    expect(onAccepted).toHaveBeenCalledTimes(1);

    await act(async () => {
      signature.reject(new Error("User rejected the request"));
      await first;
    });
  });

  /** Calling with no argument must keep working — every existing call site
   *  passes nothing. */
  it("is optional: pay() with no options still runs", async () => {
    const fetchMock = mockFetch({
      ok: true,
      expiresAt: 1_800_000_000_000,
      duplicate: false,
      overpaid: false,
      token: USDC,
      amountPaid: "1990000",
    });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useProRail(args));

    await act(async () => {
      await result.current.pay();
    });

    expect(result.current.phase).toBe("success");
  });
});

function deferred2<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
