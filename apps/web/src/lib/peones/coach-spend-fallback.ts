/**
 * Coach spend fallback — Sprint 4 commit F of Training Economy Alpha
 * 2026-06-08. Orchestrates the Peones-side payment path for Coach
 * analysis when the user has no Redis Coach credits left and is not
 * a PRO subscriber.
 *
 * Order of consumption (calibration §7, founder sign-off 2026-06-08):
 *
 *   1. Redis Coach credits      (existing path — handled by the
 *                                caller; this helper never sees that
 *                                branch).
 *   2. PRO bypass               (TODO commit G — `applyProBypass` is
 *                                hard-coded to `false` here, matching
 *                                the spend endpoint's commit C state).
 *   3. Peones spend             (this helper).
 *   4. Upsell / paywall         (caller falls through when this
 *                                helper returns `insufficient` or
 *                                `error`).
 *
 * Pure orchestration: builds the canonical Coach idempotency key,
 * calls `submitPeonesSpend`, and fires the spend-side telemetry
 * (commit D). NEVER throws. NEVER reads / writes localStorage.
 * NEVER mutates the Redis Coach credit count.
 */

import { submitPeonesSpend } from "@/lib/peones/spend-client";
import {
  emitPeonesSpendBlocked,
  emitPeonesSpendBypassed,
  emitPeonesSpendFailed,
  emitPeonesSpent,
} from "@/lib/peones/telemetry";

export type CoachPeonesAttemptArgs = {
  wallet: string;
  /** Stable identifier for this analysis. Must NOT be a timestamp —
   *  same gameId across retries collapses onto the same ledger row
   *  via the idempotency key. */
  gameId: string;
  /** Test seam. */
  submitImpl?: typeof submitPeonesSpend;
};

export type CoachPeonesAttempt =
  | {
      kind: "paid";
      /** The idempotency key the caller must forward to the analyze
       *  endpoint so the server can verify the Peones row exists. */
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
 * Builds the canonical Coach idempotency key. Same wallet + same
 * gameId always collapses to the same key — duplicate retries land
 * on the original ledger row instead of double-billing.
 *
 * Format mirrors calibration §9.1: `spend:coach:{wallet}:{gameId}`.
 */
export function buildCoachIdempotencyKey(
  wallet: string,
  gameId: string,
): string {
  return `spend:coach:${wallet.toLowerCase()}:${gameId}`;
}

/**
 * Attempts to debit 1 Peón for Coach analysis. Emits the relevant
 * telemetry event for the outcome (consumer-emit pattern from commit
 * D). Caller decides what to render — this helper just reports.
 */
export async function attemptCoachSpendWithPeones(
  args: CoachPeonesAttemptArgs,
): Promise<CoachPeonesAttempt> {
  const { wallet, gameId, submitImpl } = args;
  const submit = submitImpl ?? submitPeonesSpend;
  const idempotencyKey = buildCoachIdempotencyKey(wallet, gameId);
  const targetId = gameId;

  const result = await submit({
    wallet,
    amount: 1,
    target: "coach",
    targetId,
    idempotencyKey,
    metadata: {
      gameId,
      surface: "coach",
    },
  });

  if (result.kind === "success") {
    // Sprint 4 commit G — emit precedence:
    //   1. PRO bypass applied  → `peones_spend_bypassed`
    //   2. Real debit (debited>0) → `peones_spent`
    //   3. duplicate fresh row (debited=0, no bypass) → no emit
    //      (the original `peones_spent` already fired)
    if (result.proBypassApplied && result.quotaLimit != null && result.quotaUsed != null) {
      emitPeonesSpendBypassed({
        target: "coach",
        targetId,
        requested: 1,
        debited: 0,
        newBalance: result.newBalance,
        attestationHash: result.attestationHash,
        quotaUsed: result.quotaUsed,
        quotaLimit: result.quotaLimit,
      });
    } else if (result.debited > 0) {
      emitPeonesSpent({
        target: "coach",
        targetId,
        requested: 1,
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
      target: "coach",
      targetId,
      requested: 1,
      reason: "insufficient_balance",
    });
    return { kind: "insufficient" };
  }

  emitPeonesSpendFailed({
    target: "coach",
    targetId,
    requested: 1,
    reason: result.error,
  });
  return { kind: "error", reason: result.error };
}
