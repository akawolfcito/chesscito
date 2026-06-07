import { afterAll, describe, expect, it } from "vitest";
import type { BoardPosition, Exercise, PieceId } from "@/lib/game/types";
import { EXERCISES, PLAYABLE_PIECES } from "@/lib/game/exercises";
import { getValidTargets } from "@/lib/game/board";

/**
 * BFS verifier for exercise `optimalMoves` declarations.
 *
 * Sprint 2 commit A (Training Economy Alpha 2026-06-06) — promoted
 * from warning mode to **hard fail**. Sprint 1 cleared every legacy
 * mismatch (knight-5 a1→e5 → a1→e4 fix in commit 25fdfbee) and the
 * Sprint 1 closure run was 34/34 green, so the warning collector is
 * removed and each exercise's optimalMoves is now a hard assertion.
 *
 * From this point forward, ANY new authored exercise whose declared
 * `optimalMoves` disagrees with the BFS minimum breaks the suite. The
 * test name is the exercise ID, so vitest output points the author
 * directly at the offending entry.
 *
 * BFS protocol (unchanged from Sprint 1):
 * - Treat each `getValidTargets` result as the expansion function.
 * - Position alone is the BFS state (no per-step metadata) — pawn rules
 *   already encode rank-dependent behavior internally, so the same
 *   square always yields the same move set.
 * - `targetPos` is passed on every call so pawn capture exercises
 *   resolve the `captureSquares` allowlist consistently (per
 *   board.ts:50-66 semantics).
 * - Max search depth = 32 (defensive cap; board has 64 cells so any
 *   reachable target is found in ≤63 moves).
 */
function bfsOptimal(
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

let allPassed = true;

describe("BFS verifier — exercise optimalMoves", () => {
  for (const piece of PLAYABLE_PIECES) {
    describe(`piece: ${piece}`, () => {
      EXERCISES[piece].forEach((ex) => {
        it(`${ex.id} optimalMoves matches BFS`, () => {
          const bfs = bfsOptimal(piece, ex);
          // Reachability: every exercise must be solvable from the
          // declared startPos under the declared obstacles/captureTargets.
          expect(bfs, `${ex.id} unreachable per BFS`).not.toBeNull();
          // Optimality: the declared optimalMoves MUST equal the BFS
          // minimum. Hard fail mode — any drift breaks the suite.
          if (bfs !== ex.optimalMoves) allPassed = false;
          expect(bfs).toBe(ex.optimalMoves);
        });
      });
    });
  }

  afterAll(() => {
    if (!allPassed) return;
    // eslint-disable-next-line no-console
    console.log(
      "[BFS verifier] All exercises pass optimalMoves verification ✅",
    );
  });
});
