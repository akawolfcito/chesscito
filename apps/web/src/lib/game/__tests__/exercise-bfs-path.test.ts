/**
 * Tests for `computeExerciseBfsPath` — the full optimal-route variant of
 * `computeExerciseBfs`, intended for an editor overlay. Same
 * `getValidTargets` expansion, so the path agrees with gameplay.
 */

import { describe, it, expect } from "vitest";
import {
  computeExerciseBfs,
  computeExerciseBfsPath,
} from "@/lib/game/exercise-bfs";
import type { BoardPosition, Exercise } from "@/lib/game/types";

const pos = (file: number, rank: number): BoardPosition => ({ file, rank });

/** True when going from `a` to `b` is a single legal rook step:
 *  same file or same rank, and no obstacle sits strictly between them. */
function isLegalRookStep(
  a: BoardPosition,
  b: BoardPosition,
  obstacles: BoardPosition[],
): boolean {
  if (a.file !== b.file && a.rank !== b.rank) return false;
  if (a.file === b.file && a.rank === b.rank) return false;
  const obstacleSet = new Set(obstacles.map((o) => `${o.file},${o.rank}`));
  if (obstacleSet.has(`${b.file},${b.rank}`)) return false;
  const stepFile = Math.sign(b.file - a.file);
  const stepRank = Math.sign(b.rank - a.rank);
  let f = a.file + stepFile;
  let r = a.rank + stepRank;
  while (f !== b.file || r !== b.rank) {
    if (obstacleSet.has(`${f},${r}`)) return false;
    f += stepFile;
    r += stepRank;
  }
  return true;
}

describe("computeExerciseBfsPath", () => {
  it("returns a straight-line path with edges === optimalMoves", () => {
    const exercise: Exercise = {
      id: "rook-straight",
      startPos: pos(0, 0),
      targetPos: pos(0, 7),
      optimalMoves: 1,
    };

    const result = computeExerciseBfsPath("rook", exercise);
    expect(result).not.toBeNull();
    const { optimalMoves, path } = result!;

    // Endpoints anchor the path.
    expect(path[0]).toEqual(pos(0, 0));
    expect(path[path.length - 1]).toEqual(pos(0, 7));

    // Edges (path segments) equal the move count.
    expect(path.length - 1).toBe(optimalMoves);

    // Agrees with the count-only BFS for the same exercise.
    const counted = computeExerciseBfs("rook", exercise);
    expect(counted).not.toBeNull();
    expect(optimalMoves).toBe(counted!.optimalMoves);
  });

  it("reconstructs a forced 3-move detour with all-legal steps", () => {
    /* Rook a1 {0,0} -> h8 {7,7}.
     * Unobstructed this is 2 moves (via {7,0} or {0,7}).
     * We block the two natural corners' onward legs so the rook is
     * forced onto a 3-move detour:
     *   - Obstacle at {7,0} removes the bottom-edge -> right-column 2-move.
     *   - Obstacle at {0,7} removes the left-column -> top-edge 2-move.
     *   - Obstacle at {7,1} stops the rook one short of {7,7} when it
     *     tries to climb the right column from a lower square, so no
     *     single hub on file 7 / rank 7 yields a 2-move solution.
     * Verified empirically below: optimalMoves === 3. */
    const obstacles = [pos(7, 0), pos(0, 7), pos(7, 1)];
    const exercise: Exercise = {
      id: "rook-detour",
      startPos: pos(0, 0),
      targetPos: pos(7, 7),
      optimalMoves: 3,
      obstacles,
    };

    const result = computeExerciseBfsPath("rook", exercise);
    expect(result).not.toBeNull();
    const { optimalMoves, path } = result!;

    expect(optimalMoves).toBe(3);
    expect(path.length).toBe(4);
    expect(path[0]).toEqual(pos(0, 0));
    expect(path[path.length - 1]).toEqual(pos(7, 7));

    // Every consecutive pair is a single legal rook move.
    for (let i = 0; i < path.length - 1; i++) {
      expect(isLegalRookStep(path[i], path[i + 1], obstacles)).toBe(true);
    }

    // Agrees with count-only BFS.
    const counted = computeExerciseBfs("rook", exercise);
    expect(counted!.optimalMoves).toBe(3);
  });

  it("returns null for a genuinely unsolvable fixture (boxed knight)", () => {
    /* Knight on a1 {0,0} has exactly two jump squares on an 8x8 board:
     * {1,2} (b3) and {2,1} (c2). Block both with obstacles so the knight
     * cannot move at all, and place the target out of reach at {7,7}.
     * No path exists -> null. Verified empirically below. */
    const exercise: Exercise = {
      id: "knight-boxed",
      startPos: pos(0, 0),
      targetPos: pos(7, 7),
      optimalMoves: 0,
      obstacles: [pos(1, 2), pos(2, 1)],
    };

    const result = computeExerciseBfsPath("knight", exercise);
    expect(result).toBeNull();
  });
});
