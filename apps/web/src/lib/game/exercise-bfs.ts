/**
 * Exercise BFS — shared optimal-path helper.
 *
 * Sprint 4 commit I.1 (2026-06-08). Extracted from the existing
 * `exercises-bfs-verifier.test.ts` so the runtime can compute the
 * **first step of the optimal path** for the Peones Hint reveal
 * (founder visual-first directive 2026-06-08 — board glow instead
 * of textual banner).
 *
 * Same protocol as the verifier:
 *   - Treat each `getValidTargets` result as the expansion function.
 *   - Position alone is the BFS state.
 *   - Pass `targetPos` on every call so capture exercises resolve the
 *     captureSquares allowlist consistently.
 *   - Max depth = 32 (board has 64 cells, defensive cap).
 *
 * Returns both `optimalMoves` and `firstStep` so a future caller that
 * needs the count too (e.g. tutorial) avoids running BFS twice.
 */

import { getValidTargets } from "@/lib/game/board";
import type { BoardPosition, Exercise, PieceId } from "@/lib/game/types";

export type ExerciseBfsResult = {
  optimalMoves: number;
  firstStep: BoardPosition;
} | null;

const key = (p: BoardPosition) => `${p.file},${p.rank}`;

/**
 * Computes BFS-shortest path from `exercise.startPos` to
 * `exercise.targetPos` using the piece's move rules + obstacles +
 * captureTargets. Returns the first square on that path AND the
 * total move count. `null` when no path exists (e.g. fully blocked).
 */
export function computeExerciseBfs(
  piece: PieceId,
  exercise: Exercise,
  maxDepth = 32,
): ExerciseBfsResult {
  const start = exercise.startPos;
  const target = exercise.targetPos;
  const blockers = exercise.obstacles ?? [];
  const isCapture = exercise.isCapture ?? false;
  const captureTargets = exercise.captureTargets;

  if (key(start) === key(target)) {
    return { optimalMoves: 0, firstStep: start };
  }

  // Each BFS node tracks the first move that started its branch so
  // the firstStep is recoverable when target is reached.
  const visited = new Set<string>([key(start)]);
  const queue: Array<{
    pos: BoardPosition;
    depth: number;
    firstStep: BoardPosition | null;
  }> = [{ pos: start, depth: 0, firstStep: null }];

  while (queue.length > 0) {
    const node = queue.shift()!;
    if (node.depth >= maxDepth) continue;
    const moves = getValidTargets(
      piece,
      node.pos,
      blockers,
      isCapture,
      captureTargets,
      target,
    );
    for (const m of moves) {
      const k = key(m);
      // Track which first move spawned THIS branch. Root expansions
      // set their own first step; deeper expansions inherit it.
      const branchFirstStep = node.firstStep ?? m;
      if (k === key(target)) {
        return { optimalMoves: node.depth + 1, firstStep: branchFirstStep };
      }
      if (!visited.has(k)) {
        visited.add(k);
        queue.push({
          pos: m,
          depth: node.depth + 1,
          firstStep: branchFirstStep,
        });
      }
    }
  }
  return null;
}

export type ExerciseBfsPathResult = { optimalMoves: number; path: BoardPosition[] } | null;

/** Like computeExerciseBfs but reconstructs the full optimal path
 *  (start..target inclusive) via parent tracking. Same getValidTargets
 *  expansion, so it agrees with gameplay. */
export function computeExerciseBfsPath(
  piece: PieceId,
  exercise: Exercise,
  maxDepth = 32,
): ExerciseBfsPathResult {
  const start = exercise.startPos;
  const target = exercise.targetPos;
  const blockers = exercise.obstacles ?? [];
  const isCapture = exercise.isCapture ?? false;
  const captureTargets = exercise.captureTargets;
  if (key(start) === key(target)) return { optimalMoves: 0, path: [start] };

  const parent = new Map<string, BoardPosition | null>([[key(start), null]]);
  const queue: Array<{ pos: BoardPosition; depth: number }> = [{ pos: start, depth: 0 }];
  while (queue.length > 0) {
    const node = queue.shift()!;
    if (node.depth >= maxDepth) continue;
    const moves = getValidTargets(piece, node.pos, blockers, isCapture, captureTargets, target);
    for (const m of moves) {
      const k = key(m);
      if (parent.has(k)) continue;
      parent.set(k, node.pos);
      if (k === key(target)) {
        const path: BoardPosition[] = [];
        let cur: BoardPosition | null = m;
        while (cur) { path.unshift(cur); cur = parent.get(key(cur)) ?? null; }
        return { optimalMoves: node.depth + 1, path };
      }
      queue.push({ pos: m, depth: node.depth + 1 });
    }
  }
  return null;
}
