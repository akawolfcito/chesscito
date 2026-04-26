import { describe, it, expect, vi } from "vitest";
import { WaitForTransactionReceiptTimeoutError } from "viem";
import type { Hash, PublicClient, TransactionReceipt } from "viem";

import {
  DEFAULT_TX_TIMEOUT_MS,
  TransactionTimeoutError,
  waitForReceiptWithTimeout,
} from "../transaction-helpers";

const HASH = "0xabc" as Hash;

function makeClient(impl: () => Promise<TransactionReceipt>) {
  return {
    waitForTransactionReceipt: vi.fn(impl),
  } as unknown as PublicClient;
}

const fakeReceipt = { transactionHash: HASH } as unknown as TransactionReceipt;

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
});
