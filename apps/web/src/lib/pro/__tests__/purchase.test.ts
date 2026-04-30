import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { executeProPurchase, type ExecuteProPurchaseDeps } from "../purchase";
import { TransactionTimeoutError } from "@/lib/contracts/transaction-helpers";

const ADDRESS = "0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd" as const;
const SHOP = "0x1234567890123456789012345678901234567890" as const;
const TOKEN = {
  address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C" as `0x${string}`,
  decimals: 6,
  symbol: "USDC",
};
const APPROVE_HASH = ("0x" + "a".repeat(64)) as `0x${string}`;
const BUY_HASH = ("0x" + "b".repeat(64)) as `0x${string}`;

function setupDeps(overrides: Partial<ExecuteProPurchaseDeps> = {}) {
  const readContract = vi.fn();
  const waitForTransactionReceipt = vi.fn().mockResolvedValue({ status: "success" });
  const writeContractAsync = vi.fn();
  const selectPaymentToken = vi.fn(() => TOKEN);
  const onPhaseChange = vi.fn();

  const publicClient = {
    readContract,
    waitForTransactionReceipt,
  } as unknown as ExecuteProPurchaseDeps["publicClient"];

  const deps: ExecuteProPurchaseDeps = {
    address: ADDRESS,
    shopAddress: SHOP,
    chainId: 42220,
    publicClient,
    writeContractAsync,
    selectPaymentToken,
    onPhaseChange,
    ...overrides,
  };

  return {
    deps,
    readContract,
    waitForTransactionReceipt,
    writeContractAsync,
    selectPaymentToken,
    onPhaseChange,
  };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("executeProPurchase", () => {
  it("happy path with approve: returns success with expiresAt and signals both phases", async () => {
    const { deps, readContract, writeContractAsync, onPhaseChange } = setupDeps();
    readContract.mockResolvedValue(0n); // no allowance → approve required
    writeContractAsync
      .mockResolvedValueOnce(APPROVE_HASH)
      .mockResolvedValueOnce(BUY_HASH);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ active: true, expiresAt: 1_700_000_000_000 }),
    });

    const result = await executeProPurchase(deps);

    expect(result).toEqual({
      kind: "success",
      txHash: BUY_HASH,
      expiresAt: 1_700_000_000_000,
    });
    expect(writeContractAsync).toHaveBeenCalledTimes(2);
    expect(onPhaseChange).toHaveBeenCalledWith("purchasing");
    expect(onPhaseChange).toHaveBeenCalledWith("verifying");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/verify-pro",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ txHash: BUY_HASH, walletAddress: ADDRESS }),
      }),
    );
  });

  it("happy path with sufficient allowance: skips approve and only sends buyItem", async () => {
    const { deps, readContract, writeContractAsync } = setupDeps();
    readContract.mockResolvedValue(10n ** 18n); // huge allowance, skip approve
    writeContractAsync.mockResolvedValueOnce(BUY_HASH);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ active: true, expiresAt: 1_700_000_000_000 }),
    });

    const result = await executeProPurchase(deps);

    expect(result.kind).toBe("success");
    expect(writeContractAsync).toHaveBeenCalledTimes(1);
    const onlyCall = writeContractAsync.mock.calls[0][0];
    expect(onlyCall.functionName).toBe("buyItem");
  });

  it("returns no-token when selectPaymentToken returns null", async () => {
    const { deps, writeContractAsync, onPhaseChange } = setupDeps({
      selectPaymentToken: vi.fn(() => null),
    });

    const result = await executeProPurchase(deps);

    expect(result).toEqual({ kind: "no-token" });
    expect(writeContractAsync).not.toHaveBeenCalled();
    expect(onPhaseChange).not.toHaveBeenCalled();
  });

  it("returns cancelled when the user rejects the approve tx", async () => {
    const { deps, readContract, writeContractAsync } = setupDeps();
    readContract.mockResolvedValue(0n);
    const rejection = new Error("User rejected the request.");
    (rejection as unknown as { code: number }).code = 4001;
    writeContractAsync.mockRejectedValueOnce(rejection);

    const result = await executeProPurchase(deps);

    expect(result).toEqual({ kind: "cancelled" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns cancelled when the user rejects the buyItem tx (after approve succeeded)", async () => {
    const { deps, readContract, writeContractAsync } = setupDeps();
    readContract.mockResolvedValue(0n);
    const rejection = new Error("User rejected the request.");
    (rejection as unknown as { code: number }).code = 4001;
    writeContractAsync
      .mockResolvedValueOnce(APPROVE_HASH)
      .mockRejectedValueOnce(rejection);

    const result = await executeProPurchase(deps);

    expect(result).toEqual({ kind: "cancelled" });
  });

  it("returns timeout when waitForTransactionReceipt throws TransactionTimeoutError on the buy receipt", async () => {
    const { deps, readContract, writeContractAsync, waitForTransactionReceipt } = setupDeps();
    readContract.mockResolvedValue(10n ** 18n); // skip approve
    writeContractAsync.mockResolvedValueOnce(BUY_HASH);
    waitForTransactionReceipt.mockRejectedValueOnce(new TransactionTimeoutError(BUY_HASH, 120_000));

    const result = await executeProPurchase(deps);

    expect(result).toEqual({ kind: "timeout" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns verify-failed (with txHash) when /api/verify-pro responds 5xx", async () => {
    const { deps, readContract, writeContractAsync } = setupDeps();
    readContract.mockResolvedValue(10n ** 18n);
    writeContractAsync.mockResolvedValueOnce(BUY_HASH);
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "Internal server error" }),
    });

    const result = await executeProPurchase(deps);

    expect(result).toEqual({ kind: "verify-failed", txHash: BUY_HASH });
  });

  it("returns verify-failed when /api/verify-pro responds 200 with active=false", async () => {
    const { deps, readContract, writeContractAsync } = setupDeps();
    readContract.mockResolvedValue(10n ** 18n);
    writeContractAsync.mockResolvedValueOnce(BUY_HASH);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ active: false, expiresAt: null }),
    });

    const result = await executeProPurchase(deps);

    expect(result).toEqual({ kind: "verify-failed", txHash: BUY_HASH });
  });
});
