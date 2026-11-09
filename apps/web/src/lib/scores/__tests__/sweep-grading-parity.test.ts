/**
 * Client/server grading parity for Star Sweep.
 *
 * The screen shows a star count and the server persists one. Before
 * `gradeExerciseRun` there were four independent `computeStars` calls, and adding
 * a second grader to that shape is how a scoreboard starts lying: both graders
 * are `(number, number) => number`, so a missed call site type-checks, runs, and
 * disagrees silently. These tests pin the two ends together.
 */
import { describe, expect, it } from "vitest";

import { gradeExerciseRun, sweepStars } from "@/lib/game/scoring";
import type { BoardPosition, Exercise, PieceId } from "@/lib/game/types";
import { ATTEMPT_BUCKETS } from "@/lib/scores/attempt-grading";
import { movesCeiling } from "@/lib/scores/attempt-measurement";

const at = (file: number, rank: number): BoardPosition => ({ file, rank });

const sweep = (over: Partial<Exercise> = {}): Exercise => ({
  id: "rook-2",
  startPos: at(0, 0),
  targetPos: at(0, 7),
  optimalMoves: 3,
  targets: [at(0, 7), at(7, 7), at(7, 0)],
  ...over,
});

const plain = (over: Partial<Exercise> = {}): Exercise => ({
  id: "rook-1",
  startPos: at(1, 3),
  targetPos: at(7, 3),
  optimalMoves: 1,
  ...over,
});

/** The grader the server actually dispatches for the `exercise` family. */
function serverStars(movesUsed: number, exercise: Exercise): number {
  const bucket = ATTEMPT_BUCKETS.exercise;
  if (bucket.starless) throw new Error("exercise bucket must award stars");
  if (bucket.measureKind !== "moves") throw new Error("exercise bucket grades moves");
  return bucket.stars(movesUsed, exercise);
}

describe("client and server agree on every in-range run", () => {
  it("agrees for a sweep across its whole accepted domain", () => {
    const ex = sweep();
    for (let moves = 1; moves <= movesCeiling(ex.optimalMoves); moves += 1) {
      expect(serverStars(moves, ex)).toBe(gradeExerciseRun(moves, ex));
    }
  });

  it("agrees for an unconverted exercise across its whole accepted domain", () => {
    const ex = plain();
    for (let moves = 1; moves <= movesCeiling(ex.optimalMoves); moves += 1) {
      expect(serverStars(moves, ex)).toBe(gradeExerciseRun(moves, ex));
    }
  });

  it("actually routes a sweep through the sweep bands", () => {
    // Guards against both ends being migrated to the SAME wrong grader, which
    // the two tests above would happily call agreement.
    const ex = sweep();
    expect(serverStars(ex.optimalMoves + 99, ex)).toBe(0);
    expect(serverStars(ex.optimalMoves, ex)).toBe(3);
    expect(serverStars(5, ex)).toBe(sweepStars(5, ex.optimalMoves));
  });

  it("leaves the unconverted scale untouched — completing still earns a star", () => {
    const ex = plain();
    for (let moves = 1; moves <= movesCeiling(ex.optimalMoves); moves += 1) {
      expect(serverStars(moves, ex)).toBeGreaterThan(0);
    }
  });
});

describe("the sweep grader is reachable only through authored targets", () => {
  const pieces: PieceId[] = ["rook", "bishop", "knight", "pawn", "queen", "king"];

  it("does not change grading for any single-target exercise shape", () => {
    for (const piece of pieces) {
      const ex = plain({ id: `${piece}-1`, optimalMoves: 4 });
      // 4+ moves over optimal used to be 1★ and must stay 1★, never 0★.
      expect(gradeExerciseRun(20, ex)).toBe(1);
    }
  });
});
