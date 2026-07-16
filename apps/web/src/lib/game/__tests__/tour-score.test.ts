import { describe, expect, it } from "vitest";
import {
  TOUR_PASS_RATIO,
  tourCoverage,
  tourStars,
  isTourPass,
} from "@/lib/game/tour-score";
import { labyrinthStars } from "@/lib/game/exercises";

/**
 * The SECOND grader (spec 2026-07-16 §1: "that needs a second grader — do not
 * bend the existing one"). Labyrinths grade by move count, where FEWER is
 * better. A tour grades by coverage, where MORE is better. Feeding a tour to
 * labyrinthStars inverts it: the full tour uses the most moves and would score
 * 0, while a 2-jump dead end would score 3. Hence a separate function.
 */
describe("tourCoverage", () => {
  it("is the visited share of the reachable ceiling", () => {
    expect(tourCoverage(16, 20)).toBeCloseTo(0.8);
  });

  it("is 0 for a level with no reachable squares, never NaN", () => {
    // Guard: a fully walled start divides by zero. NaN would poison every
    // comparison downstream silently (NaN >= 0.8 is false, but so is NaN < 0.8).
    expect(tourCoverage(0, 0)).toBe(0);
  });

  it("clamps at 1 if visited somehow exceeds the ceiling", () => {
    expect(tourCoverage(21, 20)).toBe(1);
  });
});

describe("tourStars", () => {
  it("gives 0 below the 80% pass line", () => {
    expect(tourStars(15, 20)).toBe(0); // 75%
  });

  it("gives 1 exactly at the pass line", () => {
    expect(tourStars(16, 20)).toBe(1); // 80%
  });

  it("gives 2 for strong coverage short of the full tour", () => {
    expect(tourStars(18, 20)).toBe(2); // 90%
  });

  it("gives 3 only for a full tour", () => {
    expect(tourStars(20, 20)).toBe(3); // 100%
  });

  it("does not hand 3 stars to a near-miss", () => {
    expect(tourStars(19, 20)).toBe(2); // 95%
  });

  it("tells a full tour from a dead end, which labyrinthStars cannot", () => {
    // The regression this module exists to prevent, pinned with the real
    // numbers. Covering a 20-square pocket costs 19 moves, so a tour graded by
    // labyrinthStars(moves, 19) sits at or under its "optimal" ALWAYS — and the
    // first band returns 3 for anything <= optimal. Every run scores 3: the
    // perfect tour and the 3-jump dead end are indistinguishable. The grader is
    // not inverted here, it is blind. (The ledger IS inverted — see
    // recordTourBest.) tourStars separates them.
    expect(labyrinthStars(19, 19)).toBe(labyrinthStars(3, 19));
    expect(tourStars(20, 20)).toBeGreaterThan(tourStars(3, 20));
  });
});

describe("isTourPass", () => {
  it("passes at the threshold and fails a hair below it", () => {
    expect(isTourPass(16, 20)).toBe(true);
    expect(isTourPass(15, 20)).toBe(false);
  });

  it("agrees with the exported ratio", () => {
    expect(TOUR_PASS_RATIO).toBe(0.8);
  });
});
