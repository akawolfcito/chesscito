import { WaitForTransactionReceiptTimeoutError } from "viem";
import type { Hash, PublicClient, TransactionReceipt } from "viem";

export const DEFAULT_TX_TIMEOUT_MS = 120_000;

export class TransactionTimeoutError extends Error {
  readonly hash: Hash;
  readonly timeoutMs: number;

  constructor(hash: Hash, timeoutMs: number) {
    super(`Transaction timed out after ${timeoutMs}ms: ${hash}`);
    this.name = "TransactionTimeoutError";
    this.hash = hash;
    this.timeoutMs = timeoutMs;
  }
}

type WaitOpts = {
  timeoutMs?: number;
  confirmations?: number;
};

export async function waitForReceiptWithTimeout(
  client: PublicClient,
  hash: Hash,
  opts: WaitOpts = {},
): Promise<TransactionReceipt> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TX_TIMEOUT_MS;
  try {
    return await client.waitForTransactionReceipt({
      hash,
      timeout: timeoutMs,
      confirmations: opts.confirmations,
    });
  } catch (err) {
    if (
      err instanceof WaitForTransactionReceiptTimeoutError ||
      (err instanceof Error && err.name === "WaitForTransactionReceiptTimeoutError")
    ) {
      throw new TransactionTimeoutError(hash, timeoutMs);
    }
    throw err;
  }
}
