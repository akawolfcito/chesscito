/**
 * Coverage grading for set-covering games (Knight's Tour today, N-Queens next).
 * Spec: docs/specs/2026-07-16-signature-games-spec.md §1.
 *
 * ⚠️ Why this is a SEPARATE grader and not a branch inside `labyrinthStars`:
 * the two measure opposite things. A labyrinth grades by move count — FEWER is
 * better. A tour grades by coverage — MORE is better.
 *
 * Run a tour through `labyrinthStars` and it does not invert, it goes BLIND.
 * Covering an N-square pocket takes N-1 moves, which is exactly the "optimal"
 * such a level would carry, so every run lands at or under the optimum — and
 * that band returns 3 unconditionally. The perfect tour and the 3-jump dead end
 * both score 3. (The ledger is the one that truly inverts: `recordLabyrinthBest`
 * keeps the SMALLER number, so the dead end would overwrite the perfect tour as
 * a new best. Hence `recordTourBest` alongside it.)
 */

/** Coverage needed to pass a level. Founder decision, locked 2026-07-15/16. */
export const TOUR_PASS_RATIO = 0.8;

/**
 * Visited share of the reachable ceiling, clamped to 0..1. An empty ceiling
 * yields 0 rather than NaN — NaN fails every comparison in BOTH directions, so
 * it would read as "not a pass" and "not a fail" at once.
 */
export function tourCoverage(visited: number, reachable: number): number {
  if (reachable <= 0 || visited <= 0) return 0;
  return Math.min(visited / reachable, 1);
}

/**
 * Stars for a run: below 80% nothing, the pass line earns 1, and only a full
 * tour earns 3 — so the top score stays worth chasing after the pass.
 */
export function tourStars(visited: number, reachable: number): number {
  const coverage = tourCoverage(visited, reachable);
  if (coverage < TOUR_PASS_RATIO) return 0;
  if (coverage >= 1) return 3;
  if (coverage >= 0.9) return 2;
  return 1;
}

/** True when the run clears the pass line. Below it the player may still take
 *  the level with 0 stars or retry — the host owns that choice. */
export function isTourPass(visited: number, reachable: number): boolean {
  return tourCoverage(visited, reachable) >= TOUR_PASS_RATIO;
}
