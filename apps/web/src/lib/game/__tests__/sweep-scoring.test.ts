import { describe, expect, it } from "vitest";

import { computeStars, gradeExerciseRun, sweepStars } from "@/lib/game/scoring";
import type { BoardPosition, Exercise } from "@/lib/game/types";

const at = (file: number, rank: number): BoardPosition => ({ file, rank });

const exercise = (over: Partial<Exercise> = {}): Exercise => ({
  id: "rook-2",
  startPos: at(1, 3),
  targetPos: at(7, 3),
  optimalMoves: 7,
  ...over,
});

describe("sweepStars", () => {
  it("awards the perfect run three stars", () => {
    expect(sweepStars(7, 7)).toBe(3);
  });

  it("treats a below-optimal count as perfect rather than throwing", () => {
    // Defensive: a wrong optimum in the catalog must not produce a star count
    // outside the scale, which `asStarCount` turns into a failed request.
    expect(sweepStars(6, 7)).toBe(3);
  });

  it("grades the documented bands for optimal=7", () => {
    // band width = max(1, ceil(7/4)) = 2 → 3★ 7 | 2★ 8-9 | 1★ 10-11 | 0★ 12+
    expect([7, 8, 9, 10, 11, 12, 13].map((m) => sweepStars(m, 7))).toEqual([
      3, 2, 2, 1, 1, 0, 0,
    ]);
  });

  it("keeps every band at least one move wide on small optima", () => {
    // A proportional band alone collapses here: ceil(2*0.25) === ceil(2*0.5) === 1
    // would make 1★ unreachable and the scale silently three-valued.
    expect([2, 3, 4, 5].map((m) => sweepStars(m, 2))).toEqual([3, 2, 1, 0]);
  });

  it("never leaves the 0..3 scale across a wide domain", () => {
    for (let optimal = 1; optimal <= 20; optimal += 1) {
      for (let moves = 1; moves <= 60; moves += 1) {
        const stars = sweepStars(moves, optimal);
        expect([0, 1, 2, 3]).toContain(stars);
      }
    }
  });

  it("is monotonically non-increasing in moves", () => {
    // More moves can never be worth more stars — the property that makes
    // "beat your best" honest.
    for (let optimal = 1; optimal <= 20; optimal += 1) {
      for (let moves = 1; moves < 60; moves += 1) {
        expect(sweepStars(moves + 1, optimal)).toBeLessThanOrEqual(
          sweepStars(moves, optimal),
        );
      }
    }
  });

  it("can award zero, which the legacy exercise grader cannot", () => {
    // The point of the new grader: completing is no longer automatically worth a
    // star. `computeStars` bottoms out at 1 for any finite move count.
    expect(sweepStars(40, 7)).toBe(0);
    expect(computeStars(40, 7)).toBe(1);
  });
});

describe("gradeExerciseRun", () => {
  it("uses the legacy grader for a single-target exercise", () => {
    const plain = exercise({ optimalMoves: 1 });
    expect(gradeExerciseRun(1, plain)).toBe(computeStars(1, 1));
    expect(gradeExerciseRun(2, plain)).toBe(computeStars(2, 1));
    expect(gradeExerciseRun(9, plain)).toBe(computeStars(9, 1));
  });

  it("never awards zero on an unconverted exercise", () => {
    // The 56 unconverted levels keep their scale exactly: no player loses a star
    // they could previously earn just because the sweep grader shipped.
    const plain = exercise({ optimalMoves: 1 });
    for (let moves = 1; moves <= 40; moves += 1) {
      expect(gradeExerciseRun(moves, plain)).toBeGreaterThan(0);
    }
  });

  it("uses the sweep grader once there are two or more targets", () => {
    const sweep = exercise({
      optimalMoves: 7,
      targets: [at(7, 3), at(7, 6), at(2, 6)],
    });
    expect(gradeExerciseRun(7, sweep)).toBe(3);
    expect(gradeExerciseRun(9, sweep)).toBe(2);
    expect(gradeExerciseRun(12, sweep)).toBe(0);
  });

  it("keeps the legacy grader when `targets` holds a single square", () => {
    const oneTarget = exercise({ optimalMoves: 7, targets: [at(7, 3)] });
    expect(gradeExerciseRun(40, oneTarget)).toBe(computeStars(40, 7));
  });
});

describe("isPerfectRun", () => {
  it("is exactly the three-star boundary for a sweep", async () => {
    const { isPerfectRun } = await import("@/lib/game/scoring");
    const sweep = exercise({
      optimalMoves: 7,
      targets: [at(7, 3), at(7, 6), at(2, 6)],
    });
    expect(isPerfectRun(7, sweep)).toBe(true);
    expect(isPerfectRun(8, sweep)).toBe(false);
  });

  it("is defined for plain exercises too", async () => {
    const { isPerfectRun } = await import("@/lib/game/scoring");
    expect(isPerfectRun(1, exercise({ optimalMoves: 1 }))).toBe(true);
    expect(isPerfectRun(2, exercise({ optimalMoves: 1 }))).toBe(false);
  });
});
