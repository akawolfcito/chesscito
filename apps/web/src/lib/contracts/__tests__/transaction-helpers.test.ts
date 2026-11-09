import { describe, it, expect, vi } from "vitest";
import { WaitForTransactionReceiptTimeoutError } from "viem";
import type { Hash, PublicClient, TransactionReceipt } from "viem";

import {
  DEFAULT_TX_TIMEOUT_MS,
  TransactionReceiptUnverifiableError,
  TransactionRevertedError,
  TransactionTimeoutError,
  assertReceiptSuccess,
  waitForReceiptWithTimeout,
} from "../transaction-helpers";

const HASH = "0xabc" as Hash;

function makeClient(impl: () => Promise<TransactionReceipt>) {
  return {
    waitForTransactionReceipt: vi.fn(impl),
  } as unknown as PublicClient;
}

/** A receipt always carries `status`. The previous fixture omitted it, which
 *  is why every assertion here passed against a helper that never read it. */
const fakeReceipt = {
  transactionHash: HASH,
  status: "success",
} as unknown as TransactionReceipt;

const revertedReceipt = {
  transactionHash: HASH,
  status: "reverted",
  gasUsed: 21_000n,
} as unknown as TransactionReceipt;

describe("waitForReceiptWithTimeout", () => {
  it("resolves with the receipt when viem returns successfully", async () => {
    const client = makeClient(async () => fakeReceipt);
    const result = await waitForReceiptWithTimeout(client, HASH);
    expect(result).toBe(fakeReceipt);
  });

  it("forwards the default timeout to viem when none provided", async () => {
    const client = makeClient(async () => fakeReceipt);
    await waitForReceiptWithTimeout(client, HASH);
    expect(client.waitForTransactionReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ hash: HASH, timeout: DEFAULT_TX_TIMEOUT_MS }),
    );
  });

  it("forwards a custom timeout to viem when provided", async () => {
    const client = makeClient(async () => fakeReceipt);
    await waitForReceiptWithTimeout(client, HASH, { timeoutMs: 5_000 });
    expect(client.waitForTransactionReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ timeout: 5_000 }),
    );
  });

  it("wraps viem's timeout error in TransactionTimeoutError", async () => {
    const client = makeClient(async () => {
      throw new WaitForTransactionReceiptTimeoutError({ hash: HASH });
    });
    await expect(waitForReceiptWithTimeout(client, HASH, { timeoutMs: 1 })).rejects.toMatchObject({
      name: "TransactionTimeoutError",
      hash: HASH,
      timeoutMs: 1,
    });
  });

  it("re-throws unrelated errors unchanged", async () => {
    const client = makeClient(async () => {
      throw new Error("boom");
    });
    await expect(waitForReceiptWithTimeout(client, HASH)).rejects.toThrow("boom");
  });

  it("TransactionTimeoutError carries hash and timeoutMs metadata", () => {
    const err = new TransactionTimeoutError(HASH, 12_345);
    expect(err.name).toBe("TransactionTimeoutError");
    expect(err.hash).toBe(HASH);
    expect(err.timeoutMs).toBe(12_345);
    expect(err.message).toContain(HASH);
    expect(err.message).toContain("12345");
  });

  // viem resolves `waitForTransactionReceipt` with the receipt and never
  // inspects `status` (viem@2.46.3, _esm/actions/public/waitForTransactionReceipt.js
  // — emit.resolve(receipt)). A mined-but-reverted tx therefore looked
  // identical to a successful one to every caller of this helper.
  it("rejects with TransactionRevertedError when the tx mined but reverted", async () => {
    const client = makeClient(async () => revertedReceipt);
    await expect(waitForReceiptWithTimeout(client, HASH)).rejects.toBeInstanceOf(
      TransactionRevertedError,
    );
  });

  it("never resolves successfully on a reverted receipt", async () => {
    const client = makeClient(async () => revertedReceipt);
    const outcome = await waitForReceiptWithTimeout(client, HASH).then(
      () => "resolved" as const,
      () => "rejected" as const,
    );
    expect(outcome).toBe("rejected");
  });

  it("still resolves with the receipt when the tx succeeded", async () => {
    const client = makeClient(async () => fakeReceipt);
    await expect(waitForReceiptWithTimeout(client, HASH)).resolves.toBe(fakeReceipt);
  });
});

describe("assertReceiptSuccess", () => {
  it("returns the receipt when status is success", () => {
    expect(assertReceiptSuccess(HASH, fakeReceipt)).toBe(fakeReceipt);
  });

  // Asserting the constructor alone is not enough: `toThrow(undefined)` matches
  // ANY throw, so before `assertReceiptSuccess` existed these two passed on the
  // TypeError from calling a missing function. Pin the type AND the message.
  it("throws TransactionRevertedError when status is reverted", () => {
    expect(() => assertReceiptSuccess(HASH, revertedReceipt)).toThrow(
      TransactionRevertedError,
    );
    expect(() => assertReceiptSuccess(HASH, revertedReceipt)).toThrow(
      `Transaction reverted on-chain: ${HASH}`,
    );
  });

  // Fail closed, but do not lie about WHY. "The chain rejected this" and "we
  // could not read the chain's answer" are different states; collapsing them
  // would make a reverted tx and an unreadable receipt indistinguishable in
  // telemetry and in copy.
  it("throws TransactionReceiptUnverifiableError — not a revert — when status is absent", () => {
    const shapeless = { transactionHash: HASH } as unknown as TransactionReceipt;
    expect(() => assertReceiptSuccess(HASH, shapeless)).toThrow(
      TransactionReceiptUnverifiableError,
    );
    expect(() => assertReceiptSuccess(HASH, shapeless)).not.toThrow(
      TransactionRevertedError,
    );
    expect(() => assertReceiptSuccess(HASH, shapeless)).toThrow(
      `Unverifiable receipt status for ${HASH}: undefined`,
    );
  });

  it("throws TransactionReceiptUnverifiableError on an unrecognized status", () => {
    const weird = { transactionHash: HASH, status: "pending" } as unknown as TransactionReceipt;
    try {
      assertReceiptSuccess(HASH, weird);
      expect.unreachable("assertReceiptSuccess should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(TransactionReceiptUnverifiableError);
      const unverifiable = err as TransactionReceiptUnverifiableError;
      expect(unverifiable.receivedStatus).toBe("pending");
      expect(unverifiable.hash).toBe(HASH);
    }
  });

  it("waitForReceiptWithTimeout rejects an unverifiable receipt too", async () => {
    const shapeless = { transactionHash: HASH } as unknown as TransactionReceipt;
    const client = makeClient(async () => shapeless);
    await expect(waitForReceiptWithTimeout(client, HASH)).rejects.toBeInstanceOf(
      TransactionReceiptUnverifiableError,
    );
  });

  it("carries the hash and the full receipt on the error", () => {
    try {
      assertReceiptSuccess(HASH, revertedReceipt);
      expect.unreachable("assertReceiptSuccess should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(TransactionRevertedError);
      const reverted = err as TransactionRevertedError;
      expect(reverted.name).toBe("TransactionRevertedError");
      expect(reverted.hash).toBe(HASH);
      expect(reverted.receipt).toBe(revertedReceipt);
      expect(reverted.receipt.gasUsed).toBe(21_000n);
      expect(reverted.message).toContain(HASH);
    }
  });
});
