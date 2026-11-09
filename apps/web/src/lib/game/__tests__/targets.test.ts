import { describe, expect, it } from "vitest";

import { exerciseTargets, isSweep, sweepTargetKey } from "@/lib/game/targets";
import type { BoardPosition, Exercise } from "@/lib/game/types";

const at = (file: number, rank: number): BoardPosition => ({ file, rank });

/** Minimal single-target exercise — the shape 100% of the catalog had before Star Sweep. */
const plain = (over: Partial<Exercise> = {}): Exercise => ({
  id: "rook-1",
  startPos: at(1, 3),
  targetPos: at(7, 3),
  optimalMoves: 1,
  ...over,
});

describe("exerciseTargets", () => {
  it("reads a single-target exercise as a one-element list", () => {
    expect(exerciseTargets(plain())).toEqual([at(7, 3)]);
  });

  it("returns every authored target for a sweep", () => {
    const sweep = plain({ targets: [at(7, 3), at(7, 6), at(2, 6)] });
    expect(exerciseTargets(sweep)).toEqual([at(7, 3), at(7, 6), at(2, 6)]);
  });

  it("falls back to targetPos when `targets` is present but empty", () => {
    // An empty array is authoring noise, not "an exercise with no goal": treating
    // it as a sweep would produce a level that is complete before the first move.
    expect(exerciseTargets(plain({ targets: [] }))).toEqual([at(7, 3)]);
  });

  it("does not alias the authored array", () => {
    // Callers highlight/consume squares; handing them the catalog's own array
    // lets a splice mutate the catalog for every later player in the session.
    const sweep = plain({ targets: [at(7, 3), at(7, 6)] });
    const first = exerciseTargets(sweep);
    first.pop();
    expect(exerciseTargets(sweep)).toHaveLength(2);
  });
});

describe("isSweep", () => {
  it("is false for a single-target exercise", () => {
    expect(isSweep(plain())).toBe(false);
  });

  it("is false when `targets` holds exactly one square", () => {
    // One target is a plain exercise however it was authored — it must keep the
    // legacy grader, or a one-star board silently changes its scale.
    expect(isSweep(plain({ targets: [at(7, 3)] }))).toBe(false);
  });

  it("is true from two targets up", () => {
    expect(isSweep(plain({ targets: [at(7, 3), at(7, 6)] }))).toBe(true);
  });

  it("is false for an empty `targets`", () => {
    expect(isSweep(plain({ targets: [] }))).toBe(false);
  });
});

describe("sweepTargetKey", () => {
  it("is stable and distinct per square", () => {
    expect(sweepTargetKey(at(0, 0))).toBe(sweepTargetKey(at(0, 0)));
    expect(sweepTargetKey(at(0, 0))).not.toBe(sweepTargetKey(at(0, 1)));
    expect(sweepTargetKey(at(1, 0))).not.toBe(sweepTargetKey(at(0, 1)));
  });
});
