/**
 * Star Sweep — the cheapest route that collects every target.
 *
 * WHY THIS IS NOT `computeExerciseBfs`
 * ------------------------------------
 * That helper answers "shortest path from start to ONE square". A sweep asks for
 * the shortest path that visits N squares in any order, which is a (very small)
 * travelling-salesman problem: the answer depends on the ORDER, and choosing the
 * cheap order IS the skill the level tests. Summing the authored order would
 * overstate the optimum, and an overstated optimum makes the perfect run
 * trivially achievable — the exact flatness this whole slice exists to remove.
 *
 * WHY THE DECOMPOSITION IS LEGITIMATE (and where it is not)
 * --------------------------------------------------------
 * Splitting the route into independent legs is only valid when collecting a
 * target does not change the board. It does not: stars are markers, not pieces —
 * they are neither obstacles nor captures, so the rook's reachability after
 * collecting one is identical to before.
 *
 * ⛔ That argument FAILS for the pawn. A pawn never retreats, so advancing past a
 * star strands it forever and the true optimum is not the sum of pairwise
 * shortest paths. The pawn is rejected loudly rather than answered plausibly:
 * a wrong optimum here is not a slow level, it is an unreachable "perfect run"
 * and an experiment measuring a lie. See `project_pawn_never_retreats_makes_it_cheap`.
 *
 * Spec: docs/specs/2026-08-10-rook-mastery-vertical-slice-spec.md §3.4
 */

import { computeExerciseBfs } from "@/lib/game/exercise-bfs";
import { exerciseTargets } from "@/lib/game/targets";
import type { BoardPosition, Exercise, PieceId } from "@/lib/game/types";

/** Pieces whose legs are independent, so the pairwise decomposition holds. */
const RETREAT_CAPABLE: readonly PieceId[] = [
  "rook",
  "bishop",
  "knight",
  "queen",
  "king",
];

/** Guard against a combinatorial blow-up in authored content. 5! = 120 orders. */
const MAX_SWEEP_TARGETS = 5;

/**
 * Minimum total moves to collect every target from `startPos`, in any order.
 * `null` when some target is unreachable (a genuinely impossible level).
 *
 * @throws if `piece` is the pawn, or if the level authors more targets than the
 *         permutation search is willing to enumerate.
 */
export function computeSweepOptimal(
  piece: PieceId,
  exercise: Exercise,
): number | null {
  if (!RETREAT_CAPABLE.includes(piece)) {
    throw new Error(
      `computeSweepOptimal does not support '${piece}': a pawn never retreats, ` +
        `so its legs are not independent and the pairwise sum is not the optimum`,
    );
  }

  const targets = exerciseTargets(exercise);
  if (targets.length > MAX_SWEEP_TARGETS) {
    throw new Error(
      `sweep '${exercise.id}' authors ${targets.length} targets; the solver enumerates ` +
        `orders and caps at ${MAX_SWEEP_TARGETS}`,
    );
  }
  if (targets.length === 1) {
    return computeExerciseBfs(piece, exercise)?.optimalMoves ?? null;
  }

  // Leg cost is measured with the SAME expansion gameplay uses, by handing the
  // BFS a copy of this exercise re-pointed at the leg's endpoints. Anything else
  // (a private move generator, a distance formula) would be a second source of
  // truth for what a legal move is.
  const legCost = (from: BoardPosition, to: BoardPosition): number | null =>
    computeExerciseBfs(piece, { ...exercise, startPos: from, targetPos: to })
      ?.optimalMoves ?? null;

  let best: number | null = null;
  const walk = (from: BoardPosition, remaining: BoardPosition[], sofar: number) => {
    // Prune: a partial route already worse than the best complete one cannot win.
    if (best !== null && sofar >= best) return;
    if (remaining.length === 0) {
      best = sofar;
      return;
    }
    for (let i = 0; i < remaining.length; i += 1) {
      const next = remaining[i];
      const cost = legCost(from, next);
      if (cost === null) continue; // this leg is impossible; other orders may not be
      walk(next, [...remaining.slice(0, i), ...remaining.slice(i + 1)], sofar + cost);
    }
  };
  walk(exercise.startPos, targets, 0);

  return best;
}
