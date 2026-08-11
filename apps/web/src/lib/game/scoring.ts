import { isSweep } from "@/lib/game/targets";
import type { Exercise } from "@/lib/game/types";

/**
 * Calcula estrellas según precisión (movimientos usados vs óptimos).
 *
 * 3★ → movesUsed <= optimalMoves
 * 2★ → movesUsed === optimalMoves + 1
 * 1★ → movesUsed >= optimalMoves + 2
 * 0★ → no completó (reset) — no llamar esta función en ese caso
 */
export function computeStars(
  movesUsed: number,
  optimalMoves: number
): 0 | 1 | 2 | 3 {
  if (movesUsed <= optimalMoves) return 3;
  if (movesUsed === optimalMoves + 1) return 2;
  return 1;
}

export function totalStars(stars: number[]): number {
  return stars.reduce((sum, s) => sum + s, 0);
}

/* ── Star Sweep grading ───────────────────────────────────────────────────
 * Spec: docs/specs/2026-08-10-rook-mastery-vertical-slice-spec.md §3.3
 *
 * WHY A SECOND GRADER AND NOT A FIX TO `computeStars`
 * ---------------------------------------------------
 * `computeStars` is not broken — it has nothing to measure. 25% of lane-1
 * exercises are solvable in ONE move on an empty board, and no band can create a
 * gradient over a domain of one: the player taps the star and is already at the
 * theoretical minimum. Measured in prod on 2026-08-10: 21 exercises awarded 3★ to
 * 100% of everyone who touched them.
 *
 * So the fix is the CONTENT (multiple targets → a real optimum), and this grader
 * only earns its keep once `optimalMoves` is large enough to spread. Applying it
 * to the 56 unconverted exercises would regrade content 545 wallets already
 * played and could revoke mastery — which this project does not do. Hence the
 * dispatch in `gradeExerciseRun`: converted levels only.
 *
 * TWO DIFFERENCES FROM `computeStars`
 *   1. Bands are RELATIVE (a quarter of the optimum each), so a 7-move sweep and
 *      a 14-move sweep are equally forgiving in proportion, not in absolute moves.
 *   2. 0★ EXISTS. `computeStars` bottoms out at 1 for any finite count, so
 *      completing was always worth a star. Here a bad enough run earns none, which
 *      is what makes three mean something.
 */

/** Width of each star band, in moves. At least 1 so the bands never collide:
 *  a purely proportional width makes 2★ and 1★ identical for small optima and
 *  the scale silently becomes three-valued. */
function sweepBandWidth(optimalMoves: number): number {
  return Math.max(1, Math.ceil(optimalMoves / 4));
}

/**
 * Stars for a Star Sweep run. Lower `movesUsed` is better; `optimalMoves` is the
 * cheapest ORDER over all targets, computed by `computeSweepOptimal` at import
 * time.
 *
 *   3★ → movesUsed <= optimal                 (the perfect run)
 *   2★ → within one band above it
 *   1★ → within two bands
 *   0★ → beyond
 *
 * Total and monotonically non-increasing in `movesUsed` over the whole domain —
 * the property that makes "beat your best" honest, asserted by sweep in
 * `__tests__/sweep-scoring.test.ts`.
 */
export function sweepStars(
  movesUsed: number,
  optimalMoves: number,
): 0 | 1 | 2 | 3 {
  if (movesUsed <= optimalMoves) return 3;
  const band = sweepBandWidth(optimalMoves);
  if (movesUsed <= optimalMoves + band) return 2;
  if (movesUsed <= optimalMoves + band * 2) return 1;
  return 0;
}

/**
 * THE single dispatch point for grading a lane-1 run — client and server both
 * call this and nothing else.
 *
 * ⛔ Do not call `computeStars` or `sweepStars` directly from a screen or a route.
 * Before this existed, `computeStars` was invoked in four places (three in
 * `exercises-screen.tsx`, one in `ATTEMPT_BUCKETS.exercise`). Adding a second
 * grader to that shape means any site left unmigrated shows the player one grade
 * while the server persists another — the exact failure `attempt-grading.ts`
 * warns about in its header, and one that type-checks perfectly because both
 * graders are `(number, number) => number`.
 */
export function gradeExerciseRun(
  movesUsed: number,
  exercise: Pick<Exercise, "optimalMoves" | "targetPos" | "targets" | "starFloor">,
): 0 | 1 | 2 | 3 {
  const earned = isSweep(exercise as Exercise)
    ? sweepStars(movesUsed, exercise.optimalMoves)
    : computeStars(movesUsed, exercise.optimalMoves);
  // The floor is applied HERE rather than inside either grader, so both stay pure
  // functions of (moves, optimum) and the policy of one board never becomes the
  // scale of every board. `Math.max` because it raises and never lowers.
  const floor = exercise.starFloor;
  return (floor === undefined ? earned : Math.max(earned, floor)) as 0 | 1 | 2 | 3;
}

/**
 * Whether this run is the theoretical best — the "perfect run" the replay CTA
 * names. Deliberately derived from the same optimum the grader uses rather than
 * from "did it score 3★": the two agree today, and a future band change must not
 * be able to make the CTA promise a perfection the grader disagrees with.
 */
export function isPerfectRun(
  movesUsed: number,
  exercise: Pick<Exercise, "optimalMoves" | "targetPos" | "targets">,
): boolean {
  return movesUsed <= exercise.optimalMoves;
}

/**
 * Endgame trainer stars — based on move count vs par budget.
 *
 * 3★ → moves <= 10           (theoretical optimal play)
 * 2★ → moves <= parMoves     (within budget — competent)
 * 1★ → moves > parMoves      (over budget but completed)
 * 0★ → caller handles drawn/no-win separately
 */
export function endgameStars(
  moves: number,
  parMoves: number,
): 0 | 1 | 2 | 3 {
  if (moves <= 10) return 3;
  if (moves <= parMoves) return 2;
  return 1;
}
