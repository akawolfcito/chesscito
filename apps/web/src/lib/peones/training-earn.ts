/**
 * Training exercise completion → Peones earn submission.
 *
 * Sprint 3 commit F of Training Economy Alpha 2026-06-07. Mirror of
 * `lib/daily/peones-earn.ts` for the Senda training surface. The
 * exercise completion source is NOT in the daily-family cap list
 * (see PEONES_DAILY_CAP_SOURCES), so the response will never carry
 * a `cap_exhausted` semantic — the helper's state union is one
 * branch smaller than the Daily one.
 *
 * Pure async wrapper around `POST /api/peones/earn`. NEVER throws —
 * every error path collapses to `{kind:"error"}`. The caller MUST
 * gate on `delta > 0` before invoking; the helper is defensive and
 * returns a success-with-zero short-circuit if a non-positive delta
 * slips through (so the caller can drop into the same "success"
 * branch without a network call).
 */

import {
  buildTrainingExerciseIdempotencyKey,
  normalizeWallet,
} from "@/lib/peones/ledger-service";
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
 *  - Amount = bestStarsAfter - bestStarsBefore. Caller MUST already
 *    have checked `delta > 0`; defensive zero-credit short-circuit
 *    returns success-with-zero if a non-positive delta slips through.
 *  - Source = `exercise_completion`. NOT a daily-family source —
 *    cap never applies; the endpoint will not truncate the amount.
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

  const delta = bestStarsAfter - bestStarsBefore;
  if (delta <= 0) {
    // Defensive short-circuit. The hook gates on delta > 0; if the
    // gate ever fails, we return a no-op success instead of a
    // 400/error from the endpoint. Keeps the calling code's happy
    // path symmetric. Cap fields zeroed because we never spoke
    // to the server.
    return {
      kind: "success",
      credited: 0,
      newBalance: 0,
      dailyEarnedCapped: 0,
      dailyCap: 10,
      attestationHash: null,
      ledgerId: null,
      duplicate: false,
    };
  }

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
        amount: delta,
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
    dailyCap: Number(json.dailyCap ?? 10),
    attestationHash: json.attestationHash ?? null,
    ledgerId: json.ledgerId ?? null,
    duplicate: Boolean(json.duplicate),
  };
}
