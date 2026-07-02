/**
 * Shield spend fallback — Peones-side payment path for a Retry
 * Shield rescue when the user has 0 shields left.
 *
 * Mirrors coach-spend-fallback.ts's shape, with one deliberate
 * difference: the idempotency identity is `attemptSeq` (a per-attempt
 * counter), not a gameId. A shield rescue is NOT a naturally
 * idempotent artifact the way a cached Coach analysis is — replaying
 * the same request must land on the same ledger row (same attempt),
 * while a genuinely new rescue attempt (advanced attemptSeq) must get
 * a fresh row. The server additionally holds a one-row-one-grant
 * Redis guard (see /api/shields/spend) so a captured, replayed key
 * cannot mint unlimited rescues from a single payment — see red-team
 * P0-2/P0-3 in docs/superpowers/specs/2026-07-01-coach-shield-peones-
 * consumables-phase1-redteam.md.
 *
 * Pure orchestration: NEVER throws. NEVER reads/writes localStorage.
 * NEVER mutates the server-side shield counter directly — that
 * happens inside /api/shields/spend's Peones branch (Task B4).
 */

import { submitPeonesSpend } from "@/lib/peones/spend-client";
import {
  emitPeonesSpendBlocked,
  emitPeonesSpendBypassed,
  emitPeonesSpendFailed,
  emitPeonesSpent,
} from "@/lib/peones/telemetry";

/** Peones cost of a shield rescue. Single source of truth — reused by
 *  the spend call below and by the FailRescueModal variant D copy so
 *  the displayed price can never drift from what's actually charged. */
export const SHIELD_RESCUE_PEONES_COST = 2;

export type ShieldPeonesAttemptArgs = {
  wallet: string;
  /** Stable per-rescue-attempt identifier. Must be the SAME value for
   *  every retry of one rescue tap (network blip, double-tap) and a
   *  DIFFERENT value for a genuinely new rescue attempt — never a
   *  timestamp, never a bare exercise id (see module doc). */
  attemptSeq: number;
  /** Test seam. */
  submitImpl?: typeof submitPeonesSpend;
};

export type ShieldPeonesAttempt =
  | {
      kind: "paid";
      /** Forwarded to /api/shields/spend so the server can verify the
       *  Peones row exists AND has not already been consumed. */
      peonesIdempotencyKey: string;
      debited: number;
      duplicate: boolean;
      proBypassApplied: boolean;
      newBalance: number;
      attestationHash: string;
    }
  | { kind: "insufficient" }
  | { kind: "error"; reason: string };

/**
 * Builds the canonical Shield idempotency key. Same wallet + same
 * attemptSeq always collapses to the same key.
 *
 * Format mirrors calibration §9.1: `spend:shield:{wallet}:{attemptSeq}`.
 */
export function buildShieldIdempotencyKey(
  wallet: string,
  attemptSeq: number,
): string {
  return `spend:shield:${wallet.toLowerCase()}:${attemptSeq}`;
}

/**
 * Attempts to debit 2 Peones for a Shield rescue. Emits the relevant
 * telemetry event for the outcome. Caller decides what to render.
 */
export async function attemptShieldSpendWithPeones(
  args: ShieldPeonesAttemptArgs,
): Promise<ShieldPeonesAttempt> {
  const { wallet, attemptSeq, submitImpl } = args;
  const submit = submitImpl ?? submitPeonesSpend;
  const idempotencyKey = buildShieldIdempotencyKey(wallet, attemptSeq);
  const targetId = String(attemptSeq);

  const result = await submit({
    wallet,
    amount: SHIELD_RESCUE_PEONES_COST,
    target: "shield",
    targetId,
    idempotencyKey,
    metadata: {
      attemptSeq,
      surface: "shield",
    },
  });

  if (result.kind === "success") {
    if (result.proBypassApplied && result.quotaLimit != null && result.quotaUsed != null) {
      emitPeonesSpendBypassed({
        target: "shield",
        targetId,
        requested: SHIELD_RESCUE_PEONES_COST,
        debited: 0,
        newBalance: result.newBalance,
        attestationHash: result.attestationHash,
        quotaUsed: result.quotaUsed,
        quotaLimit: result.quotaLimit,
      });
    } else if (result.debited > 0 && !result.duplicate) {
      emitPeonesSpent({
        target: "shield",
        targetId,
        requested: SHIELD_RESCUE_PEONES_COST,
        debited: result.debited,
        newBalance: result.newBalance,
        attestationHash: result.attestationHash,
        duplicate: result.duplicate,
        proBypassApplied: result.proBypassApplied,
      });
    }
    return {
      kind: "paid",
      peonesIdempotencyKey: idempotencyKey,
      debited: result.debited,
      duplicate: result.duplicate,
      proBypassApplied: result.proBypassApplied,
      newBalance: result.newBalance,
      attestationHash: result.attestationHash,
    };
  }

  if (result.kind === "insufficient_balance") {
    emitPeonesSpendBlocked({
      target: "shield",
      targetId,
      requested: 2,
      reason: "insufficient_balance",
    });
    return { kind: "insufficient" };
  }

  emitPeonesSpendFailed({
    target: "shield",
    targetId,
    requested: 2,
    reason: result.error,
  });
  return { kind: "error", reason: result.error };
}
