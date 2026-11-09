/**
 * Star Sweep — the ONE reader of an exercise's goal squares.
 *
 * WHY THIS MODULE EXISTS
 * ----------------------
 * `Exercise.targetPos` is a single square, and it was the whole contract until
 * Star Sweep: every lane-1 exercise asked the player to reach exactly one place.
 * That singular field is the structural reason "catch the stars" ships with one
 * star, and it is read directly by the board, the BFS helper, the Peones hint and
 * `getValidTargets`.
 *
 * So `targets` is ADDITIVE and `targetPos` never goes away. A sweep keeps
 * `targetPos === targets[0]` (enforced by the content linter) so every existing
 * reader keeps working on a sweep board instead of crashing or, worse, silently
 * grading a different level.
 *
 * ⛔ NEVER read `exercise.targets` directly. A reader that does will see `undefined`
 * on the 56 unconverted exercises and quietly fall back to "no goal at all" — a
 * failure with no symptom, because the board still renders. Go through
 * `exerciseTargets`, which is total over both shapes. This is the
 * guard-the-grantor rule the score path already follows.
 *
 * Spec: docs/specs/2026-08-10-rook-mastery-vertical-slice-spec.md §3.2
 */

import type { BoardPosition, Exercise } from "@/lib/game/types";

/**
 * Every square this exercise asks the player to collect, in authoring order.
 *
 * Order is presentational only — a sweep is collected in ANY order, and choosing
 * the cheapest order is the skill the level tests. Returns a fresh array on every
 * call: callers filter and splice these while playing, and handing out the
 * catalog's own array would let one session's gameplay mutate the catalog for
 * every later render.
 */
export function exerciseTargets(exercise: Exercise): BoardPosition[] {
  const authored = exercise.targets;
  if (authored && authored.length > 0) return [...authored];
  return [exercise.targetPos];
}

/**
 * Whether this exercise is a Star Sweep — i.e. more than one square to collect.
 *
 * One target is a plain exercise no matter how it was authored, so a `targets`
 * of length 1 is deliberately NOT a sweep: it must keep `computeStars`, or a
 * one-goal board would silently switch to the relative star bands and change its
 * scale under players who already earned on it.
 */
export function isSweep(exercise: Exercise): boolean {
  return exerciseTargets(exercise).length > 1;
}

/** Stable identity for a square — for Sets, React keys and "already collected". */
export function sweepTargetKey(position: BoardPosition): string {
  return `${position.file},${position.rank}`;
}
