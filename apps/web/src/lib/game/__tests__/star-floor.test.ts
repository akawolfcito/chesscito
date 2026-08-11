/**
 * `starFloor` — a per-exercise policy, deliberately NOT a grader change.
 *
 * `rook-2` is the second thing a new player ever touches (520 wallets) and the
 * measured bottleneck of the product is activation, not difficulty. Its sweep
 * optimum is 3, so six moves would earn 0★ from someone still learning how a rook
 * moves. The floor protects that one board WITHOUT softening the scale everywhere:
 * `rook-distance-1` and `rook-4` keep 0★ reachable, and `sweepStars` itself is
 * untouched.
 */
import { describe, expect, it } from "vitest";

import {
  computeStars,
  gradeExerciseRun,
  isPerfectRun,
  sweepStars,
} from "@/lib/game/scoring";
import type { BoardPosition, Exercise } from "@/lib/game/types";

const at = (file: number, rank: number): BoardPosition => ({ file, rank });

const sweep = (over: Partial<Exercise> = {}): Exercise => ({
  id: "rook-2",
  startPos: at(4, 1),
  targetPos: at(4, 7),
  optimalMoves: 3,
  targets: [at(4, 7), at(1, 7), at(1, 3)],
  ...over,
});

describe("starFloor is a policy of ONE exercise, not of the grader", () => {
  it("leaves the global grader untouched", () => {
    // The floored board and the raw grader must disagree — otherwise the policy
    // was implemented by softening `sweepStars`, which is what we refused to do.
    expect(sweepStars(9, 3)).toBe(0);
    expect(gradeExerciseRun(9, sweep({ starFloor: 1 }))).toBe(1);
  });

  it("keeps 0★ reachable on an exercise without the policy", () => {
    expect(gradeExerciseRun(9, sweep({ starFloor: undefined }))).toBe(0);
  });

  it("raises only the runs that fell below it", () => {
    const floored = sweep({ starFloor: 1 });
    expect([3, 4, 5, 6, 9, 20].map((m) => gradeExerciseRun(m, floored))).toEqual([
      3, 2, 1, 1, 1, 1,
    ]);
  });

  it("never lowers a grade — it is a floor, not a clamp", () => {
    const floored = sweep({ starFloor: 2 });
    expect(gradeExerciseRun(3, floored)).toBe(3); // perfect stays perfect
    expect(gradeExerciseRun(4, floored)).toBe(2);
    expect(gradeExerciseRun(20, floored)).toBe(2);
  });

  it("applies to plain exercises too", () => {
    // The policy is about a BOARD being someone's first contact, which has
    // nothing to do with how many targets it has.
    const plain = sweep({ targets: undefined, optimalMoves: 1, starFloor: 2 });
    expect(computeStars(9, 1)).toBe(1);
    expect(gradeExerciseRun(9, plain)).toBe(2);
  });

  it("does not touch what counts as a perfect run", () => {
    // The floor moves the star, never the optimum. A floored 1★ run must still
    // read as "not perfect", or the replay CTA would promise a goal already met.
    const floored = sweep({ starFloor: 1 });
    expect(gradeExerciseRun(9, floored)).toBe(1);
    expect(isPerfectRun(9, floored)).toBe(false);
    expect(isPerfectRun(3, floored)).toBe(true);
  });

  it("stays inside the 0..3 scale over a wide domain", () => {
    for (const floor of [undefined, 1, 2] as const) {
      for (let moves = 1; moves <= 60; moves += 1) {
        const stars = gradeExerciseRun(moves, sweep({ starFloor: floor }));
        expect([0, 1, 2, 3]).toContain(stars);
      }
    }
  });
});
