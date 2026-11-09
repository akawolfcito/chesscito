import type { BoardPosition, Exercise, PieceId } from "@/lib/game/types";
import { getValidTargets } from "@/lib/game/board";

/**
 * BFS minimum-move solver over the REAL movement engine
 * (`getValidTargets`), shared by the exercises and labyrinths
 * solvability verifiers.
 *
 * Protocol (unchanged since Training Economy Alpha Sprint 1):
 * - Each `getValidTargets` result is the expansion function.
 * - Position alone is the BFS state — pawn rules already encode
 *   rank-dependent behavior internally, so the same square always
 *   yields the same move set.
 * - `targetPos` is passed on every call so pawn capture entries
 *   resolve the `captureSquares` allowlist consistently
 *   (board.ts:50-66 semantics).
 * - Max search depth = 32 (defensive cap; board has 64 cells).
 *
 * Returns the minimum number of moves from startPos to targetPos, or
 * null when the target is unreachable under the declared obstacles.
 */
export function bfsOptimal(
  piece: PieceId,
  exercise: Exercise,
  maxDepth = 32,
): number | null {
  const key = (p: BoardPosition) => `${p.file},${p.rank}`;
  const start = exercise.startPos;
  const target = exercise.targetPos;
  const blockers = exercise.obstacles ?? [];
  const isCapture = exercise.isCapture ?? false;
  const captureTargets = exercise.captureTargets;

  if (key(start) === key(target)) return 0;

  const visited = new Set<string>([key(start)]);
  const queue: Array<{ pos: BoardPosition; depth: number }> = [
    { pos: start, depth: 0 },
  ];

  while (queue.length > 0) {
    const { pos, depth } = queue.shift()!;
    if (depth >= maxDepth) continue;
    const moves = getValidTargets(
      piece,
      pos,
      blockers,
      isCapture,
      captureTargets,
      target,
    );
    for (const m of moves) {
      const k = key(m);
      if (k === key(target)) return depth + 1;
      if (!visited.has(k)) {
        visited.add(k);
        queue.push({ pos: m, depth: depth + 1 });
      }
    }
  }
  return null;
}
