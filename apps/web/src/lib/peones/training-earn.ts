/**
 * Training progress → Peones earn submission.
 *
 * Economy V1 (2026-07-21, docs/economy/peones-v1-policy.md): training
 * pays +1 Peón per MILESTONE of five newly completed exercises — the
 * 5th, 10th, 15th… — not per exercise.
 *
 * What that replaces: a flat +1 on every first completion, which made
 * the training path the fastest Peón faucet in the app and scaled
 * linearly with a catalog that keeps growing. Stars stay the mastery
 * signal; Peones stay a currency you earn slowly.
 *
 * What still pays nothing: repeating an exercise, improving its stars,
 * and re-completing content already counted. The tier is derived from a
 * lifetime count of UNIQUE completions, so none of those move it.
 *
 * Pure async wrapper around `POST /api/peones/earn`. NEVER throws —
 * every error path collapses to `{kind:"error"}`. Returns a
 * success-with-zero short-circuit (no network call) when this
 * completion did not cross a milestone.
 */

import {
  buildExerciseMilestoneIdempotencyKey,
  exerciseMilestoneTier,
  normalizeWallet,
} from "@/lib/peones/ledger-service";
import { dispatchPeonesChange } from "@/lib/peones/peones-events";
import { PEONES_DAILY_CAP } from "@/lib/peones/types";

/** One milestone is worth exactly one Peón. */
export const EXERCISE_MILESTONE_EARN_AMOUNT = 1;

export type TrainingExerciseRewardState =
  | { kind: "pending" }
  | {
      kind: "success";
      credited: number;
      /** Post-credit balance the endpoint computed optimistically.
       *  Sprint 3 commit H — powers `peones_earned` telemetry without
       *  a second round-trip. */
      newBalance: number;
      dailyEarnedCapped: number;
      dailyCap: number;
      attestationHash: string | null;
      ledgerId: number | null;
      duplicate: boolean;
      /** Milestone tier this call settled. 0 when nothing was crossed. */
      tier: number;
    }
  | { kind: "error" };

export type SubmitExerciseMilestoneEarnArgs = {
  wallet: string;
  /** Lifetime count of uniquely completed exercises BEFORE this
   *  completion landed. */
  completedBefore: number;
  /** …and AFTER. The pair is what decides whether a milestone was
   *  crossed; the absolute numbers never reach the server. */
  completedAfter: number;
  /** Override for testing. Defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
};

type EarnResponse = {
  credited?: number;
  newBalance?: number;
  dailyEarnedCapped?: number;
  dailyCap?: number;
  attestationHash?: string | null;
  ledgerId?: number | null;
  duplicate?: boolean;
};

function noopSuccess(tier: number): TrainingExerciseRewardState {
  return {
    kind: "success",
    credited: 0,
    newBalance: 0,
    dailyEarnedCapped: 0,
    dailyCap: PEONES_DAILY_CAP,
    attestationHash: null,
    ledgerId: null,
    duplicate: false,
    tier,
  };
}

/**
 * POST /api/peones/earn when a completion crosses an exercise milestone.
 *
 *  - Amount = flat 1 per milestone.
 *  - Source = `exercise_completion` (unchanged — the ledger taxonomy is
 *    historical and a new literal would cost a schema migration for no
 *    economic gain). The MEANING of the row changed, not its label; the
 *    idempotency key is what tells the two eras apart (`training:…` for
 *    the old per-exercise rows, `exercise_milestone:…` for these).
 *  - sourceId = `milestone:{tier}` so an audit query can pivot on the
 *    tier without parsing the key.
 *  - Daily-capped, so the endpoint may truncate the +1 to the remaining
 *    headroom — a player who crosses two milestones in one sitting on a
 *    day they also solved the Daily still cannot exceed the cap.
 */
export async function submitExerciseMilestoneEarn(
  args: SubmitExerciseMilestoneEarnArgs,
): Promise<TrainingExerciseRewardState> {
  const { wallet: rawWallet, completedBefore, completedAfter, fetchImpl } = args;
  const doFetch = fetchImpl ?? fetch;

  const tierBefore = exerciseMilestoneTier(completedBefore);
  const tier = exerciseMilestoneTier(completedAfter);

  // No new tier → no network call. Crossing several tiers at once is
  // not reachable (one completion moves the count by one) but if it
  // ever were, we credit the highest tier only: the key is the tier,
  // so lower ones stay claimable later and can never double-pay.
  if (tier <= tierBefore || tier < 1) {
    return noopSuccess(tierBefore);
  }

  let wallet: string;
  try {
    wallet = normalizeWallet(rawWallet);
  } catch {
    return { kind: "error" };
  }

  const idempotencyKey = buildExerciseMilestoneIdempotencyKey(wallet, tier);

  let res: Response;
  try {
    res = await doFetch("/api/peones/earn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wallet,
        amount: EXERCISE_MILESTONE_EARN_AMOUNT,
        source: "exercise_completion",
        sourceId: `milestone:${tier}`,
        idempotencyKey,
      }),
    });
  } catch {
    return { kind: "error" };
  }

  if (!res.ok) {
    return { kind: "error" };
  }

  let json: EarnResponse;
  try {
    json = (await res.json()) as EarnResponse;
  } catch {
    return { kind: "error" };
  }

  const credited = Number(json.credited ?? 0);

  // Only a real credit moves the balance. `credited === 0` is the
  // cap-exhausted case (200 with no row written) — the chip must not
  // flicker a refetch for a milestone that paid nothing.
  if (credited > 0) {
    dispatchPeonesChange();
  }

  return {
    kind: "success",
    credited,
    newBalance: Number(json.newBalance ?? 0),
    dailyEarnedCapped: Number(json.dailyEarnedCapped ?? 0),
    dailyCap: Number(json.dailyCap ?? PEONES_DAILY_CAP),
    attestationHash: json.attestationHash ?? null,
    ledgerId: json.ledgerId ?? null,
    duplicate: Boolean(json.duplicate),
    tier,
  };
}
