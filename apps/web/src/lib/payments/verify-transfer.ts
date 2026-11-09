/**
 * Stablecoin single-tx payment rail — Transfer-event verification (slice
 * D, 2026-06-09).
 *
 * Pure helper: given the logs of a tx receipt, find + validate the ERC20
 * `Transfer(from, to, value)` that pays a Peones pack. No network, no
 * endpoint, no ledger, no env reads (the caller passes the expected
 * treasury in). FAIL-CLOSED: a null/invalid treasury rejects — preview and
 * production share env, so an unconfigured treasury must never verify.
 *
 * Plan: docs/product/chesscito-stablecoin-single-tx-payment-rail-calibration-2026-06-09.md.
 */

import { decodeEventLog } from "viem";
import { erc20Abi } from "@/lib/contracts/tokens";
import { isValidAddress } from "@/lib/payments/rail-config";

export type TransferLogInput = {
  /** Emitting token contract address. */
  address: string;
  topics: readonly `0x${string}`[];
  data: `0x${string}`;
  logIndex: number;
};

export type VerifyTransferParams = {
  logs: readonly TransferLogInput[];
  /** Expected recipient. `null`/invalid → fail closed. */
  expectedTreasury: string | null;
  /** Buyer wallet (the Transfer `from`). */
  fromWallet: string;
  /** Lowercased accepted-stablecoin allowlist. */
  acceptedTokenAddressesLower: readonly string[];
  /** Minimum token amount required (normalized price). */
  expectedAmount: bigint;
  /** Accept value > expectedAmount (default true; see overpay policy). */
  overpayAccepted?: boolean;
};

export type VerifyTransferFailReason =
  | "treasury-not-configured"
  | "invalid-treasury"
  | "invalid-wallet"
  | "no-matching-transfer"
  | "amount-too-low"
  | "overpay-not-accepted";

export type VerifyTransferResult =
  | {
      ok: true;
      token: string;
      from: string;
      to: string;
      amount: bigint;
      logIndex: number;
      overpaid: boolean;
    }
  | { ok: false; reason: VerifyTransferFailReason };

/**
 * Verify that the receipt logs contain a stablecoin Transfer from
 * `fromWallet` to `expectedTreasury` for at least `expectedAmount`.
 * Returns the matching log (with amount + logIndex for idempotency) or a
 * typed rejection reason. Fail-closed on an unconfigured/invalid treasury.
 */
export function verifyStablecoinTransfer(
  p: VerifyTransferParams,
): VerifyTransferResult {
  // Fail-closed guards first.
  if (p.expectedTreasury == null) {
    return { ok: false, reason: "treasury-not-configured" };
  }
  if (!isValidAddress(p.expectedTreasury)) {
    return { ok: false, reason: "invalid-treasury" };
  }
  if (!isValidAddress(p.fromWallet)) {
    return { ok: false, reason: "invalid-wallet" };
  }

  const treasuryLower = p.expectedTreasury.toLowerCase();
  const fromLower = p.fromWallet.toLowerCase();
  const allowlist = new Set(
    p.acceptedTokenAddressesLower.map((a) => a.toLowerCase()),
  );
  const overpayAccepted = p.overpayAccepted ?? true;

  let sawLowAmount = false;
  let sawOverpayBlocked = false;

  for (const log of p.logs) {
    const tokenLower = log.address.toLowerCase();
    if (!allowlist.has(tokenLower)) continue;

    let eventName: string;
    let args: { from: string; to: string; value: bigint };
    try {
      const decoded = decodeEventLog({
        abi: erc20Abi,
        topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
        data: log.data,
      });
      eventName = decoded.eventName;
      args = decoded.args as unknown as { from: string; to: string; value: bigint };
    } catch {
      continue; // not a decodable erc20 event log
    }
    if (eventName !== "Transfer") continue;

    const from = String(args.from).toLowerCase();
    const to = String(args.to).toLowerCase();
    const value = BigInt(args.value);

    if (to !== treasuryLower || from !== fromLower) continue;

    if (value < p.expectedAmount) {
      sawLowAmount = true;
      continue;
    }
    if (value > p.expectedAmount && !overpayAccepted) {
      sawOverpayBlocked = true;
      continue;
    }

    return {
      ok: true,
      token: tokenLower,
      from,
      to,
      amount: value,
      logIndex: log.logIndex,
      overpaid: value > p.expectedAmount,
    };
  }

  if (sawOverpayBlocked) return { ok: false, reason: "overpay-not-accepted" };
  if (sawLowAmount) return { ok: false, reason: "amount-too-low" };
  return { ok: false, reason: "no-matching-transfer" };
}
