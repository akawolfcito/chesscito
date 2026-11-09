/**
 * ONE dispatch point for grading a labyrinth run.
 *
 * THE FAILURE THIS PREVENTS
 * ------------------------
 * Three places grade a labyrinth today, and every one of them called
 * `labyrinthStars(moves, optimal)` directly: the screen the player watches
 * (`exercises-screen.tsx`), the attempt row the scoreboard persists
 * (`ATTEMPT_BUCKETS.labyrinth`) and the signing route (`sign-labyrinth`). The
 * moment a labyrinth can be a Star Sweep, that scale is wrong for it — a sweep's
 * optimum is several times larger, so the fixed +2/+4 bands are proportionally
 * far harsher than the relative ones lane 1 uses.
 *
 * ⛔ Migrating two of the three would type-check perfectly and ship a screen that
 * shows one grade while the row persists another: `labyrinthStars` and
 * `sweepStars` are both `(number, number) => number`. That is the exact hazard
 * `gradeExerciseRun` was created for on lane 1, restated here rather than
 * rediscovered.
 */
import { describe, expect, it } from "vitest";

import { gradeLabyrinthRun, labyrinthStars, sweepStars } from "@/lib/game/scoring";
import type { Exercise } from "@/lib/game/types";

const pos = (file: number, rank: number) => ({ file, rank });

/** A plain labyrinth: one goal, optimum 4. */
const plain = {
  optimalMoves: 4,
  targetPos: pos(7, 7),
} as Exercise;

/** The same maze asking for three stars, optimum 12. */
const sweep = {
  optimalMoves: 12,
  targetPos: pos(7, 7),
  targets: [pos(7, 7), pos(0, 7), pos(3, 3)],
} as Exercise;

describe("gradeLabyrinthRun", () => {
  it("keeps the legacy fixed bands for a one-goal maze", () => {
    // Unchanged behaviour for all 19 existing labyrinths — the migration must be
    // invisible to every board that is not a sweep.
    for (const moves of [3, 4, 5, 6, 7, 8, 9, 20]) {
      expect(gradeLabyrinthRun(moves, plain)).toBe(labyrinthStars(moves, 4));
    }
  });

  it("grades a multi-star maze on the RELATIVE bands", () => {
    for (const moves of [12, 15, 18, 30]) {
      expect(gradeLabyrinthRun(moves, sweep)).toBe(sweepStars(moves, 12));
    }
  });

  it("the two scales genuinely disagree — this is not a formality", () => {
    // Optimum 12 → the relative band is 3, so 2★ reaches 15 and 1★ reaches 18;
    // the fixed bands stop at 14 and 16. A player would watch one number while
    // the scoreboard kept the other, on the same run.
    expect(gradeLabyrinthRun(15, sweep)).toBe(2);
    expect(labyrinthStars(15, 12)).toBe(1);

    expect(gradeLabyrinthRun(18, sweep)).toBe(1);
    expect(labyrinthStars(18, 12)).toBe(0);
  });

  it("awards the perfect run to the exact optimum", () => {
    expect(gradeLabyrinthRun(12, sweep)).toBe(3);
    expect(gradeLabyrinthRun(4, plain)).toBe(3);
  });

  it("can award ZERO on a sweep, like lane 1", () => {
    // A maze the player wandered through is a real outcome, not a floor of 1.
    expect(gradeLabyrinthRun(99, sweep)).toBe(0);
  });
});
