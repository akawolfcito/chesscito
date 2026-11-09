/**
 * Star Sweep — what the completion screen says, as data.
 *
 * THE PROMISE IS "BEAT YOUR RECORD", NOT "FIX THIS RUN"
 * ----------------------------------------------------
 * Every number here is derived from the BEST, never from the attempt just
 * played. Played 10 with a record of 9 against an optimum of 7, the CTA says
 * **2**, not 3: the player is being invited to beat 9, and a gap measured from a
 * throwaway run would move on every attempt while the goal did not. A number the
 * player cannot reconcile with what they are chasing reads as a lie, and this one
 * is the entire experiment.
 *
 * Pure and separate from the component so the semantics can be pinned by tests
 * instead of eyeballed in a screenshot — the VR would never catch this: a chip
 * measures ~450 px against a tolerance of ~1.646.
 *
 * Spec: docs/specs/2026-08-10-rook-mastery-vertical-slice-spec.md §5
 */

import { exerciseTargets } from "@/lib/game/targets";
import type { Exercise } from "@/lib/game/types";

export type SweepResultInput = {
  exercise: Exercise;
  /** Moves used by the run that just completed. */
  runMoves: number;
  /** The record BEFORE this run, absent on first contact. */
  previousBest: number | undefined;
};

export type SweepResultPresentation = {
  /** The record including this run — the number the CTA promises to beat. */
  bestMoves: number;
  optimalMoves: number;
  /** `bestMoves - optimalMoves`, floored at 0. Never the current run's gap. */
  gapToPerfect: number;
  isPerfect: boolean;
  /** False on a perfect record: there is nothing left to beat. */
  showReplayCta: boolean;
  /** How many goals this board has. */
  totalTargets: number;
  /** PRESENTATION ONLY. The machine models a plain exercise as a one-target
   *  sweep so no game logic branches on it, but printing "1/1" on the 56 legacy
   *  boards is noise: a counter that never changes teaches nothing. */
  showCounter: boolean;
};

export function toSweepResultPresentation({
  exercise,
  runMoves,
  previousBest,
}: SweepResultInput): SweepResultPresentation {
  const bestMoves =
    previousBest === undefined ? runMoves : Math.min(previousBest, runMoves);
  const optimalMoves = exercise.optimalMoves;
  // Floored at 0: a best below the declared optimum means the OPTIMUM is wrong,
  // and the CTA must not render "2 to go" as a negative while that is chased
  // down. It reads as perfect, which is the honest reading of "you beat the
  // theoretical minimum we computed".
  const gapToPerfect = Math.max(0, bestMoves - optimalMoves);
  const isPerfect = gapToPerfect === 0;
  const totalTargets = exerciseTargets(exercise).length;

  return {
    bestMoves,
    optimalMoves,
    gapToPerfect,
    isPerfect,
    showReplayCta: !isPerfect,
    totalTargets,
    showCounter: totalTargets > 1,
  };
}
