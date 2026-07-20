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
  delete process.env.NEXT_PUBLIC_GET_PEONES_TREASURY_CANARY_ENABLED;
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
    expect(fetch).toHaveBeenCalledWith("/api/verify-payment", expect.any(Object));
  });

  it("duplicate:true → idempotent success (not an error)", async () => {
    vi.stubGlobal("fetch", mockFetch({ ok: true, duplicate: true, peonesCredited: 50, token: USDC, amountPaid: "500000" }));
    const { result } = renderHook(() => usePaymentRail(args));
    await act(async () => { await result.current.pay(); });
    expect(result.current.phase).toBe("success");
    expect(result.current.result?.duplicate).toBe(true);
  });
});

describe("usePaymentRail — disabled Treasury canary foundation", () => {
  const INTENT_ID = "123e4567-e89b-42d3-a456-426614174000";
  const TREASURY = "0x1234567890abcdef1234567890abcdef12345678";
  const intent = {
    id: INTENT_ID,
    wallet: WALLET,
    sku: "peones_pack_50",
    token: USDC,
    tokenSymbol: "USDC",
    tokenDecimals: 6,
    expectedAmount: "500000",
    chainId: 42220,
    treasury: TREASURY,
    configVersion: "canary-v1",
    priceVersion: "peones-50-v1",
    requiredConfirmations: 2,
    expiresAt: "2099-01-01T00:00:00.000Z",
    authBinding: "client_asserted_wallet",
  };

  function canaryFetch(verifyBody: Record<string, unknown> = {
    ok: true,
    duplicate: false,
    peonesCredited: 50,
    token: USDC,
    amountPaid: "500000",
    overpaid: false,
  }) {
    return vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/payment-intents/get-peones" && init?.method === "POST") {
        return { json: () => Promise.resolve({ ok: true, intent }) };
      }
      if (url === "/api/payment-intents/get-peones" && init?.method === "PATCH") {
        const report = JSON.parse(String(init.body)) as { submissionState: string };
        return {
          json: () => Promise.resolve({
            ok: true,
            intentId: INTENT_ID,
            lifecycle: report.submissionState,
            recoverable: true,
            retrySafe: false,
          }),
        };
      }
      return { json: () => Promise.resolve(verifyBody) };
    });
  }

  it("requests an intent first and submits exactly one token transfer", async () => {
    process.env.NEXT_PUBLIC_GET_PEONES_TREASURY_CANARY_ENABLED = "true";
    const fetchMock = canaryFetch();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => usePaymentRail(args));
    await act(async () => { await result.current.pay(); });

    expect(fetchMock.mock.calls[0][0]).toBe("/api/payment-intents/get-peones");
    expect(writeMock).toHaveBeenCalledTimes(1);
    expect(writeMock.mock.calls[0][0]).toMatchObject({
      address: USDC,
      functionName: "transfer",
      args: [TREASURY, 500_000n],
    });
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toMatchObject({
      submissionState: "SUBMITTING",
      providerResultKind: "WALLET_REQUESTED",
    });
    expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body))).toMatchObject({
      submissionState: "SUBMITTED",
      txHash: HASH,
    });
    expect(fetchMock.mock.calls[3][0]).toBe("/api/verify-payment/get-peones-canary");
    expect(result.current.result?.peonesCredited).toBe(50);
  });

  it("unknown provider submission state does not auto-resend", async () => {
    process.env.NEXT_PUBLIC_GET_PEONES_TREASURY_CANARY_ENABLED = "true";
    const fetchMock = canaryFetch();
    vi.stubGlobal("fetch", fetchMock);
    writeMock.mockRejectedValueOnce(new Error("provider timeout"));

    const { result } = renderHook(() => usePaymentRail(args));
    await act(async () => { await result.current.pay(); });

    expect(writeMock).toHaveBeenCalledTimes(1);
    expect(result.current.errorReason).toBe("unknown_submission_state");
    expect(result.current.paymentRetryBlocked).toBe(true);
    await act(async () => { await result.current.pay(); });
    expect(writeMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls.filter(([url, init]) =>
      url === "/api/payment-intents/get-peones" && init?.method === "POST"
    )).toHaveLength(1);

    act(() => { result.current.reset(); });
    await act(async () => { await result.current.pay(); });
    expect(writeMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls.filter(([url, init]) =>
      url === "/api/payment-intents/get-peones" && init?.method === "POST"
    )).toHaveLength(1);
  });

  it("classifies EIP-1193 code 4001 as CANCELLED and permits a fresh explicit action", async () => {
    process.env.NEXT_PUBLIC_GET_PEONES_TREASURY_CANARY_ENABLED = "true";
    const fetchMock = canaryFetch();
    vi.stubGlobal("fetch", fetchMock);
    writeMock.mockRejectedValueOnce({ code: 4001 });

    const { result } = renderHook(() => usePaymentRail(args));
    await act(async () => { await result.current.pay(); });
    expect(result.current.errorReason).toBe("user_rejected");
    const cancellation = fetchMock.mock.calls
      .filter(([, init]) => init?.method === "PATCH")
      .map(([, init]) => JSON.parse(String(init?.body)))
      .find((body) => body.submissionState === "CANCELLED");
    expect(cancellation).toMatchObject({
      providerResultKind: "USER_CANCELLED",
      errorCode: "4001",
    });

    writeMock.mockResolvedValueOnce(HASH);
    await act(async () => { await result.current.pay(); });
    expect(writeMock).toHaveBeenCalledTimes(2);
  });

  it("blocks retry when the provider returns an unexpected result without a hash", async () => {
    process.env.NEXT_PUBLIC_GET_PEONES_TREASURY_CANARY_ENABLED = "true";
    const fetchMock = canaryFetch();
    vi.stubGlobal("fetch", fetchMock);
    writeMock.mockResolvedValueOnce({ status: "pending" });

    const { result } = renderHook(() => usePaymentRail(args));
    await act(async () => { await result.current.pay(); });
    expect(result.current.errorReason).toBe("unknown_submission_state");
    expect(result.current.paymentRetryBlocked).toBe(true);
    const unexpected = fetchMock.mock.calls
      .filter(([, init]) => init?.method === "PATCH")
      .map(([, init]) => JSON.parse(String(init?.body)))
      .find((body) => body.providerResultKind === "UNEXPECTED_RESULT");
    expect(unexpected).toMatchObject({
      submissionState: "SUBMITTING",
      errorCode: "UNEXPECTED_PROVIDER_RESULT",
    });
  });

  it("preserves and verifies a hash carried by a rejected provider result", async () => {
    process.env.NEXT_PUBLIC_GET_PEONES_TREASURY_CANARY_ENABLED = "true";
    const fetchMock = canaryFetch();
    vi.stubGlobal("fetch", fetchMock);
    writeMock.mockRejectedValueOnce({ transactionHash: HASH });

    const { result } = renderHook(() => usePaymentRail(args));
    await act(async () => { await result.current.pay(); });
    expect(result.current.phase).toBe("success");
    expect(result.current.txHash).toBe(HASH);
    expect(waitReceiptMock).toHaveBeenCalledWith({ hash: HASH });
    const submitted = fetchMock.mock.calls
      .filter(([, init]) => init?.method === "PATCH")
      .map(([, init]) => JSON.parse(String(init?.body)))
      .find((body) => body.submissionState === "SUBMITTED");
    expect(submitted).toMatchObject({ txHash: HASH, providerResultKind: "TRANSACTION_HASH" });
  });

  it("uses an immediate mutex so concurrent pay calls create one intent and one wallet request", async () => {
    process.env.NEXT_PUBLIC_GET_PEONES_TREASURY_CANARY_ENABLED = "true";
    const fetchMock = canaryFetch();
    vi.stubGlobal("fetch", fetchMock);
    let resolveWrite!: (hash: typeof HASH) => void;
    writeMock.mockReturnValueOnce(new Promise<typeof HASH>((resolve) => {
      resolveWrite = resolve;
    }));

    const { result } = renderHook(() => usePaymentRail(args));
    await act(async () => {
      const first = result.current.pay();
      const second = result.current.pay();
      await Promise.resolve();
      resolveWrite(HASH);
      await Promise.all([first, second]);
    });
    expect(writeMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls.filter(([url, init]) =>
      url === "/api/payment-intents/get-peones" && init?.method === "POST"
    )).toHaveLength(1);
  });

  it("recovers a persisted submitted intent after reload without creating another transfer", async () => {
    process.env.NEXT_PUBLIC_GET_PEONES_TREASURY_CANARY_ENABLED = "true";
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/payment-intents/get-peones" && init?.method === "POST") {
        return { json: () => Promise.resolve({
          ok: false,
          error: "unresolved_submission_state",
          intentId: INTENT_ID,
          lifecycle: "SUBMITTED",
          txHash: HASH,
          recoverable: true,
          retrySafe: false,
        }) };
      }
      return { json: () => Promise.resolve({
        ok: true,
        duplicate: true,
        peonesCredited: 50,
        token: USDC,
        amountPaid: "500000",
      }) };
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => usePaymentRail(args));
    await act(async () => { await result.current.pay(); });
    expect(writeMock).not.toHaveBeenCalled();
    expect(result.current.txHash).toBe(HASH);
    expect(result.current.errorReason).toBe("verification_pending");

    await act(async () => { await result.current.verifyAgain(); });
    expect(result.current.phase).toBe("success");
    expect(result.current.result?.duplicate).toBe(true);
    expect(writeMock).not.toHaveBeenCalled();
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

  it("transient network failure after tx confirms → auto-retries verify → success", async () => {
    // tx already settled on-chain; the first verify POST throws (network blip).
    // With a retry budget the hook re-POSTs without user action and recovers.
    const okBody = { ok: true, peonesCredited: 50, duplicate: false, token: USDC, amountPaid: "500000" };
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({ json: () => Promise.resolve(okBody) });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => usePaymentRail({ ...args, retryDelaysMs: [0] }));
    await act(async () => { await result.current.pay(); });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.phase).toBe("success");
    expect(result.current.result?.peonesCredited).toBe(50);
  });

  it("network failure with no retry budget → error, keeps txHash", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const { result } = renderHook(() => usePaymentRail({ ...args, retryDelaysMs: [] }));
    await act(async () => { await result.current.pay(); });
    expect(result.current.phase).toBe("error");
    expect(result.current.txHash).toBe(HASH);
  });

  it("retriable verify error (ledger_write_failed) → retries → success", async () => {
    const okBody = { ok: true, peonesCredited: 50, duplicate: true, token: USDC, amountPaid: "500000" };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ json: () => Promise.resolve({ ok: false, error: "ledger_write_failed" }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve(okBody) });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => usePaymentRail({ ...args, retryDelaysMs: [0] }));
    await act(async () => { await result.current.pay(); });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.phase).toBe("success");
  });

  it("deterministic verify error (amount_too_low) → NOT retried, terminal", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ ok: false, error: "amount_too_low" }) });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => usePaymentRail({ ...args, retryDelaysMs: [0, 0, 0] }));
    await act(async () => { await result.current.pay(); });
    expect(fetchMock).toHaveBeenCalledTimes(1); // no retry on a deterministic error
    expect(result.current.phase).toBe("error");
    expect(result.current.errorReason).toBe("amount_too_low");
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
