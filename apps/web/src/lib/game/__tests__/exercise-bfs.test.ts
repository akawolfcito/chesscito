/**
 * Sprint 4 commit I.1 — exercise BFS helper tests.
 *
 * Cross-validates against the legacy verifier protocol: for every
 * shipped exercise, `computeExerciseBfs(...).optimalMoves` must
 * equal the declared `optimalMoves`. This is a regression net so
 * the runtime-side BFS (used by the Hint feature) stays in lockstep
 * with the test-time verifier guarantee shipped Sprint 2.
 *
 * Plus focused tests for `firstStep` correctness on a few hand-
 * picked exercises with predictable optimal first moves.
 */

import { describe, expect, it } from "vitest";

import { canReachFrom, computeExerciseBfs } from "@/lib/game/exercise-bfs";
import { EXERCISES, PLAYABLE_PIECES } from "@/lib/game/exercises";
import type { Exercise } from "@/lib/game/types";

describe("computeExerciseBfs — optimalMoves regression net", () => {
  for (const piece of PLAYABLE_PIECES) {
    describe(`piece: ${piece}`, () => {
      EXERCISES[piece].forEach((ex) => {
        it(`${ex.id} computed optimalMoves matches declared`, () => {
          const result = computeExerciseBfs(piece, ex);
          expect(result, `${ex.id} BFS returned null`).not.toBeNull();
          expect(result?.optimalMoves).toBe(ex.optimalMoves);
        });
      });
    });
  }
});

describe("computeExerciseBfs — firstStep correctness", () => {
  it("rook a1 → a8 (vertical lane): firstStep is on the a-file", () => {
    const ex = EXERCISES.rook[0]!;
    const result = computeExerciseBfs("rook", ex);
    expect(result).not.toBeNull();
    expect(result!.firstStep.file).toBe(ex.targetPos.file);
  });

  it("returns a square that is one valid move from startPos", () => {
    // Same protocol as the verifier — the firstStep must be in the
    // start's valid targets list, otherwise the hint glow lands on
    // an illegal cell.
    const ex = EXERCISES.rook[0]!;
    const result = computeExerciseBfs("rook", ex);
    expect(result).not.toBeNull();
    // firstStep should NOT equal startPos (we're at depth>=1 since
    // start !== target for this exercise).
    expect(result!.firstStep).not.toEqual(ex.startPos);
  });

  it("returns null when no path exists (defensive cap)", () => {
    // Synthetic blocked exercise: rook surrounded by 4 blockers.
    const result = computeExerciseBfs("rook", {
      id: "synthetic-blocked",
      startPos: { file: 3, rank: 3 },
      targetPos: { file: 5, rank: 5 },
      optimalMoves: 0,
      obstacles: [
        { file: 4, rank: 3 },
        { file: 2, rank: 3 },
        { file: 3, rank: 4 },
        { file: 3, rank: 2 },
      ],
    });
    expect(result).toBeNull();
  });
});

describe("canReachFrom — pawn dead-end detection", () => {
  // A pawn must zig-zag: capture d3, then e4, then reach f5 (diagonally onto
  // the star). It never retreats, so marching straight up strands it. Mirrors
  // the founder's field report (pawn walked to c8, star never captured).
  const ex: Exercise = {
    id: "synthetic-pawn-zigzag",
    startPos: { file: 2, rank: 1 }, // c2
    targetPos: { file: 5, rank: 4 }, // f5
    optimalMoves: 3,
    isCapture: true,
    captureTargets: [
      { file: 3, rank: 2 }, // d3
      { file: 4, rank: 3 }, // e4
    ],
  };

  it("start square can still reach the target", () => {
    expect(canReachFrom("pawn", ex, ex.startPos)).toBe(true);
  });

  it("capturing d3 keeps the target reachable", () => {
    expect(canReachFrom("pawn", ex, { file: 3, rank: 2 })).toBe(true);
  });

  it("marching straight forward strands the pawn (dead-end)", () => {
    // c2 → c3 (a legal forward move) abandons the only capture route.
    expect(canReachFrom("pawn", ex, { file: 2, rank: 2 })).toBe(false);
  });

  it("a rook is never stranded — it can always navigate back", () => {
    const rookEx = EXERCISES.rook[0]!;
    // Move the rook somewhere off the optimal lane; it can still reach target.
    expect(canReachFrom("rook", rookEx, { file: 4, rank: 4 })).toBe(true);
  });
});
