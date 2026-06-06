import { afterAll, describe, expect, it } from "vitest";
import type { BoardPosition, Exercise, PieceId } from "@/lib/game/types";
import { EXERCISES, PLAYABLE_PIECES } from "@/lib/game/exercises";
import { getValidTargets } from "@/lib/game/board";

/**
 * BFS verifier for exercise `optimalMoves` declarations.
 *
 * Sprint 1 commit 2 of Training Economy Alpha 2026-06-05 — runs in
 * **warning mode**: mismatches are collected and reported via a single
 * console.table at the end, but the test suite does NOT fail. The goal
 * here is to surface pre-existing drift between authored `optimalMoves`
 * and what the actual move rules support, WITHOUT blocking Sprint 1
 * delivery on legacy entries we don't want to touch yet.
 *
 * Promotion to hard fail is scheduled for Sprint 2 (once any mismatches
 * found here are resolved or explicitly waived in spec).
 *
 * BFS protocol:
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

type Mismatch = {
  piece: PieceId;
  exerciseId: string;
  declared: number;
  bfs: number | "unreachable";
  possibleCause: string;
};

const mismatches: Mismatch[] = [];

function classifyCause(declared: number, bfs: number | null, ex: Exercise): string {
  if (bfs === null) {
    return "BFS could not reach targetPos — verify startPos/targetPos/obstacles authoring.";
  }
  if (bfs < declared) {
    return "Declared optimalMoves too HIGH — a shorter path exists per BFS. Update declaration or add obstacles to forbid the shortcut.";
  }
  if (bfs > declared) {
    const hasObstacles = (ex.obstacles?.length ?? 0) > 0;
    const hasCaptureTargets = (ex.captureTargets?.length ?? 0) > 0;
    if (hasObstacles || hasCaptureTargets) {
      return "Declared optimalMoves too LOW — obstacles/captureTargets force a longer path per BFS. Likely an authoring error.";
    }
    return "Declared optimalMoves too LOW — BFS finds longer path. Re-check rule semantics for this piece.";
  }
  return "No mismatch (should not reach this branch).";
}

describe("BFS verifier — exercise optimalMoves", () => {
  for (const piece of PLAYABLE_PIECES) {
    describe(`piece: ${piece}`, () => {
      EXERCISES[piece].forEach((ex) => {
        it(`${ex.id} is reachable per BFS (warning mode for optimalMoves drift)`, () => {
          const bfs = bfsOptimal(piece, ex);
          // Hard expectation: every exercise must be reachable. If BFS
          // returns null, the exercise is broken authoring — fail loud.
          expect(bfs).not.toBeNull();

          // Soft expectation: optimalMoves should equal BFS optimum.
          // Sprint 1 warning mode — collect but do not fail.
          if (bfs !== null && bfs !== ex.optimalMoves) {
            mismatches.push({
              piece,
              exerciseId: ex.id,
              declared: ex.optimalMoves,
              bfs,
              possibleCause: classifyCause(ex.optimalMoves, bfs, ex),
            });
          }
        });
      });
    });
  }

  afterAll(() => {
    if (mismatches.length === 0) {
      // eslint-disable-next-line no-console
      console.log(
        "[BFS verifier] All exercises pass optimalMoves verification ✅",
      );
      return;
    }
    // eslint-disable-next-line no-console
    console.warn(
      `[BFS verifier] Found ${mismatches.length} optimalMoves mismatch(es) — Sprint 1 warning mode, not failing.`,
    );
    // eslint-disable-next-line no-console
    console.table(mismatches);
  });
});
