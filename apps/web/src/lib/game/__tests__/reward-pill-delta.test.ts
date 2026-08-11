/**
 * The reward row announces GAINS, not run results.
 *
 * The pill reads "+N Stars" and its own comment says the row exists to surface
 * "what the player just gained". It used to be fed the run's raw grade, so a
 * replay announced a reward that never arrived — "+1 STARS" beside "YOUR BEST 3
 * · PERFECT RUN", when a star map only ever keeps the MAX and nothing was added
 * (device report 2026-08-11).
 *
 * The arithmetic lives here so it is pinned independently of the 4,700-line
 * screen that performs it.
 */
import { describe, expect, it } from "vitest";

import { gradeExerciseRun } from "@/lib/game/scoring";
import type { BoardPosition, Exercise } from "@/lib/game/types";

const at = (file: number, rank: number): BoardPosition => ({ file, rank });

const sweep = (over: Partial<Exercise> = {}): Exercise => ({
  id: "rook-2",
  startPos: at(4, 1),
  targetPos: at(4, 7),
  optimalMoves: 3,
  targets: [at(4, 7), at(1, 7), at(1, 3)],
  starFloor: 1,
  ...over,
});

/** Exactly what `handleMove` computes for the pill. */
const starsGained = (
  movesUsed: number,
  exercise: Exercise,
  bestBefore: number,
  scoringFrozen = false,
): number =>
  scoringFrozen
    ? 0
    : Math.max(0, gradeExerciseRun(movesUsed, exercise) - bestBefore);

describe("stars gained", () => {
  it("is the full grade on a first solve", () => {
    expect(starsGained(3, sweep(), 0)).toBe(3);
  });

  it("is ZERO when a replay cannot beat the stored best", () => {
    // The exact case seen on device: best already 3, this run floors to 1.
    expect(gradeExerciseRun(20, sweep())).toBe(1); // the floor is doing its job
    expect(starsGained(20, sweep(), 3)).toBe(0); // and nothing was gained
  });

  it("is ZERO when a replay merely ties the best", () => {
    expect(starsGained(3, sweep(), 3)).toBe(0);
  });

  it("is the DIFFERENCE when a replay genuinely improves", () => {
    // 2★ run over a stored 1★ adds exactly one.
    expect(gradeExerciseRun(4, sweep())).toBe(2);
    expect(starsGained(4, sweep(), 1)).toBe(1);
  });

  it("is never negative", () => {
    for (let best = 0; best <= 3; best += 1) {
      for (let moves = 1; moves <= 40; moves += 1) {
        expect(starsGained(moves, sweep(), best)).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("is ZERO whenever scoring is frozen, however good the run", () => {
    // A frozen replay persists nothing, so it gained nothing — announcing a
    // reward there is the same lie in a different costume.
    expect(starsGained(3, sweep(), 0, true)).toBe(0);
  });

  it("never exceeds what the star map can actually hold", () => {
    for (let best = 0; best <= 3; best += 1) {
      for (let moves = 1; moves <= 40; moves += 1) {
        const gained = starsGained(moves, sweep(), best);
        expect(best + gained).toBeLessThanOrEqual(3);
      }
    }
  });
});

describe("plain exercises keep the same contract", () => {
  const plain = (): Exercise => ({
    id: "rook-1",
    startPos: at(1, 3),
    targetPos: at(7, 3),
    optimalMoves: 1,
  });

  it("gains nothing on a replay of an already-perfect board", () => {
    expect(starsGained(1, plain(), 3)).toBe(0);
  });

  it("still gains on a first solve", () => {
    expect(starsGained(1, plain(), 0)).toBe(3);
  });
});
