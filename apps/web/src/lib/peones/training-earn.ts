/**
 * Training exercise completion → Peones earn submission.
 *
 * Sprint 3 commit F of Training Economy Alpha 2026-06-07. Mirror of
 * `lib/daily/peones-earn.ts` for the Senda training surface.
 *
 * Economy recalibration 2026-06-10: the reward is now a flat +1 Peón on
 * the FIRST completion of an exercise (bestStarsBefore === 0 &&
 * bestStarsAfter > 0), NOT the star delta. Re-completing or improving
 * stars never earns again (no farming). Stars stay the progress/mastery
 * signal; Peones are a controlled currency. The source
 * (`exercise_completion`) is now in the daily cap (PEONES_DAILY_CAP_SOURCES),
 * so the endpoint can truncate the +1 to remaining headroom and the
 * response CAN carry the cap semantics.
 *
 * Pure async wrapper around `POST /api/peones/earn`. NEVER throws —
 * every error path collapses to `{kind:"error"}`. Returns a
 * success-with-zero short-circuit (no network call) when the completion
 * is not a fresh first completion.
 */

import {
  buildTrainingExerciseIdempotencyKey,
  normalizeWallet,
} from "@/lib/peones/ledger-service";
import { PEONES_DAILY_CAP } from "@/lib/peones/types";
import type { PieceId } from "@/lib/game/types";

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
    }
  | { kind: "error" };

export type SubmitTrainingExerciseEarnArgs = {
  wallet: string;
  piece: PieceId;
  exerciseId: string;
  bestStarsBefore: number;
  bestStarsAfter: number;
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

/**
 * POST /api/peones/earn for a Senda exercise completion.
 *
 *  - Amount = flat 1 (economy recalibration 2026-06-10). NOT the star
 *    delta. Earns only on the FIRST completion (bestStarsBefore === 0 &&
 *    bestStarsAfter > 0); any later improvement / re-completion is a no-op.
 *  - Source = `exercise_completion`. Now a daily-cap source, so the
 *    endpoint may truncate the +1 to the remaining daily headroom.
 *  - sourceId = `${piece}:${exerciseId}` so the audit / dashboard
 *    can pivot by piece without parsing the idempotency key.
 *  - idempotencyKey = buildTrainingExerciseIdempotencyKey(...)
 *    from commit B. Same wallet + piece + exerciseId + same
 *    before→after pair always collapse to ONE ledger row.
 */
export async function submitTrainingExerciseEarn(
  args: SubmitTrainingExerciseEarnArgs,
): Promise<TrainingExerciseRewardState> {
  const {
    wallet: rawWallet,
    piece,
    exerciseId,
    bestStarsBefore,
    bestStarsAfter,
    fetchImpl,
  } = args;
  const doFetch = fetchImpl ?? fetch;

  // Flat reward, first-completion only. bestStarsBefore > 0 means the
  // exercise was already completed → no second earn (anti-farm). A
  // non-positive after also short-circuits defensively.
  const isFreshCompletion = bestStarsBefore === 0 && bestStarsAfter > 0;
  if (!isFreshCompletion) {
    // No-op success (no network call). Cap fields zeroed because we never
    // spoke to the server. Keeps the caller's happy path symmetric.
    return {
      kind: "success",
      credited: 0,
      newBalance: 0,
      dailyEarnedCapped: 0,
      dailyCap: PEONES_DAILY_CAP,
      attestationHash: null,
      ledgerId: null,
      duplicate: false,
    };
  }

  // Flat +1 (not the star delta).
  const amount = 1;

  let wallet: string;
  try {
    wallet = normalizeWallet(rawWallet);
  } catch {
    return { kind: "error" };
  }

  const idempotencyKey = buildTrainingExerciseIdempotencyKey(
    wallet,
    piece,
    exerciseId,
    bestStarsBefore,
    bestStarsAfter,
  );

  let res: Response;
  try {
    res = await doFetch("/api/peones/earn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wallet,
        amount,
        source: "exercise_completion",
        sourceId: `${piece}:${exerciseId}`,
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

  return {
    kind: "success",
    credited: Number(json.credited ?? 0),
    newBalance: Number(json.newBalance ?? 0),
    dailyEarnedCapped: Number(json.dailyEarnedCapped ?? 0),
    dailyCap: Number(json.dailyCap ?? PEONES_DAILY_CAP),
    attestationHash: json.attestationHash ?? null,
    ledgerId: json.ledgerId ?? null,
    duplicate: Boolean(json.duplicate),
  };
}
