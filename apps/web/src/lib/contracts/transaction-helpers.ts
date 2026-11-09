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

/** A transaction that was mined and reverted. Distinct from a timeout: the
 *  chain reached a verdict, and the verdict was no. Carries the full receipt
 *  so callers can read `gasUsed` / `logs` / `blockNumber` for diagnostics. */
export class TransactionRevertedError extends Error {
  readonly hash: Hash;
  readonly receipt: TransactionReceipt;

  constructor(hash: Hash, receipt: TransactionReceipt) {
    super(`Transaction reverted on-chain: ${hash}`);
    this.name = "TransactionRevertedError";
    this.hash = hash;
    this.receipt = receipt;
  }
}

/** A receipt whose `status` we cannot read. NOT a revert: the chain never told
 *  us it rejected the tx, we simply have no verdict. Kept distinct so telemetry
 *  never reports "the chain said no" when the truth is "we don't know". */
export class TransactionReceiptUnverifiableError extends Error {
  readonly hash: Hash;
  readonly receipt: TransactionReceipt;
  readonly receivedStatus: unknown;

  constructor(hash: Hash, receipt: TransactionReceipt, receivedStatus: unknown) {
    super(`Unverifiable receipt status for ${hash}: ${String(receivedStatus)}`);
    this.name = "TransactionReceiptUnverifiableError";
    this.hash = hash;
    this.receipt = receipt;
    this.receivedStatus = receivedStatus;
  }
}

/** Gate every receipt through here before treating it as a success.
 *
 *  Pure, so it works on a receipt from any source — viem, or a wallet-provided
 *  override. viem's `waitForTransactionReceipt` resolves with reverted receipts
 *  without inspecting `status` (viem@2.46.3), which is why this check cannot
 *  live in the caller's happy path.
 *
 *  Fails closed three ways, not two: success, revert, and "no verdict". */
export function assertReceiptSuccess(
  hash: Hash,
  receipt: TransactionReceipt,
): TransactionReceipt {
  if (receipt?.status === "success") return receipt;
  if (receipt?.status === "reverted") throw new TransactionRevertedError(hash, receipt);
  throw new TransactionReceiptUnverifiableError(hash, receipt, receipt?.status);
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
    const receipt = await client.waitForTransactionReceipt({
      hash,
      timeout: timeoutMs,
      confirmations: opts.confirmations,
    });
    return assertReceiptSuccess(hash, receipt);
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
