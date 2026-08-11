/**
 * Star Sweep — the collection state of ONE run, as a pure state machine.
 *
 * WHY THIS IS NOT A CHECK INSIDE THE SCREEN
 * -----------------------------------------
 * The win condition used to be three lines inside `handleMove`:
 *
 *   const isTarget = position.file === ex.targetPos.file
 *                 && position.rank === ex.targetPos.rank;
 *
 * With a sweep that is actively wrong, and wrong in the most expensive direction:
 * `targetPos` IS `targets[0]`, so the level would END on the first star, with one
 * of three collected, and `sweepStars(1, 3)` would hand out THREE STARS for one
 * move — the board strictly easier than before the work that was meant to make it
 * harder. It lives here so it can be proven, not reviewed.
 *
 * ONE PATH FOR BOTH SHAPES
 * ------------------------
 * A plain exercise is modelled as a one-target sweep (`exerciseTargets` already
 * returns `[targetPos]` for it), so the screen NEVER branches on `isSweep`. A
 * branch there would mean the 56 unconverted exercises and the 3 converted ones
 * take different code to the same completion, and only one of the two would keep
 * being tested.
 *
 * Order is free by design: choosing the cheap order is the skill the level tests,
 * so the machine cares only about the SET collected, never the sequence.
 *
 * Spec: docs/specs/2026-08-10-rook-mastery-vertical-slice-spec.md §5
 */

import { exerciseTargets, sweepTargetKey } from "@/lib/game/targets";
import type { BoardPosition, Exercise } from "@/lib/game/types";

export type SweepRunState = {
  /** Keys of the targets collected so far. A SET: landing twice on one star is
   *  one star, which is what keeps a rook shuffling between two squares from
   *  completing a three-target level. */
  readonly collectedKeys: ReadonlySet<string>;
  /** Targets still to collect, in authoring order (presentation only). */
  readonly remaining: readonly BoardPosition[];
  readonly collectedCount: number;
  readonly totalCount: number;
  /** True only once EVERY target has been collected. */
  readonly isComplete: boolean;
};

function build(exercise: Exercise, collectedKeys: ReadonlySet<string>): SweepRunState {
  const targets = exerciseTargets(exercise);
  const remaining = targets.filter((t) => !collectedKeys.has(sweepTargetKey(t)));
  return {
    collectedKeys,
    remaining,
    collectedCount: targets.length - remaining.length,
    totalCount: targets.length,
    isComplete: remaining.length === 0,
  };
}

/** A fresh run: nothing collected. */
export function startSweepRun(exercise: Exercise): SweepRunState {
  return build(exercise, new Set());
}

/**
 * Apply a landing. Collects the square when it is an uncollected target and is
 * otherwise a no-op.
 *
 * Returns the SAME state object when nothing changed — a landing on an empty
 * square, or on a star already taken. The screen renders from this and keys
 * effects on it; minting a new object per move would restart those effects on
 * every step of the route.
 */
export function collectAt(
  state: SweepRunState,
  exercise: Exercise,
  position: BoardPosition,
): SweepRunState {
  const key = sweepTargetKey(position);
  const isTarget = exerciseTargets(exercise).some((t) => sweepTargetKey(t) === key);
  if (!isTarget || state.collectedKeys.has(key)) return state;

  const next = new Set(state.collectedKeys);
  next.add(key);
  return build(exercise, next);
}
