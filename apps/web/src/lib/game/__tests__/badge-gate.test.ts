import { describe, it, expect } from "vitest";
import type { Exercise, PieceId } from "@/lib/game/types";
import {
  BADGE_COMPLETION_RATIO,
  badgeRequiredCount,
  isBadgeEarned,
  completedExerciseCount,
} from "@/lib/game/exercises";

/** Badge gate = COMPLETION of a fraction of the pool, not stars.
 *  Founder decision 2026-07-17: the badge proves constancy, not skill,
 *  so a 1★ run and a 3★ run count the same and nobody is stranded. */
describe("badge gate (completion-based)", () => {
  it("the ratio is 80%", () => {
    expect(BADGE_COMPLETION_RATIO).toBe(0.8);
  });

  describe("badgeRequiredCount — 80% of the pool, rounded up", () => {
    it("10-exercise pool needs 8", () => {
      expect(badgeRequiredCount(10)).toBe(8);
    });
    it("9-exercise pool needs 8 (ceil of 7.2)", () => {
      expect(badgeRequiredCount(9)).toBe(8);
    });
    it("5-exercise pool needs 4", () => {
      expect(badgeRequiredCount(5)).toBe(4);
    });
    it("an empty pool needs 0", () => {
      expect(badgeRequiredCount(0)).toBe(0);
    });
    it("grows with the pool so the bar never trivializes", () => {
      expect(badgeRequiredCount(40)).toBe(32);
    });
  });

  describe("isBadgeEarned — completed vs required", () => {
    it("earned when completed meets the requirement", () => {
      expect(isBadgeEarned(8, 10)).toBe(true);
    });
    it("not earned one exercise short", () => {
      expect(isBadgeEarned(7, 10)).toBe(false);
    });
    it("earned at 8/9 (required is 8)", () => {
      expect(isBadgeEarned(8, 9)).toBe(true);
    });
    it("not earned at 7/9", () => {
      expect(isBadgeEarned(7, 9)).toBe(false);
    });
    it("an empty pool is never earnable", () => {
      expect(isBadgeEarned(0, 0)).toBe(false);
    });
    it("zero progress never earns", () => {
      expect(isBadgeEarned(0, 10)).toBe(false);
    });
  });

  describe("completedExerciseCount — an exercise counts once it has ≥1★", () => {
    const catalog = {
      rook: Array.from({ length: 10 }, (_, i) => ({ id: `r${i}` })),
      bishop: [],
      knight: [],
      pawn: [],
      queen: [],
      king: [],
    } as unknown as Record<PieceId, Exercise[]>;

    it("counts distinct exercises with a positive star", () => {
      const stars = { r0: 1, r1: 3, r2: 2 };
      expect(completedExerciseCount("rook", stars, catalog)).toBe(3);
    });
    it("ignores exercises at 0★ and unknown ids", () => {
      const stars = { r0: 0, r1: 2, zzz: 3 };
      expect(completedExerciseCount("rook", stars, catalog)).toBe(1);
    });
    it("empty progress → 0", () => {
      expect(completedExerciseCount("rook", {}, catalog)).toBe(0);
    });
  });

  describe("stars are irrelevant to the gate", () => {
    const catalog = {
      rook: Array.from({ length: 10 }, (_, i) => ({ id: `r${i}` })),
      bishop: [],
      knight: [],
      pawn: [],
      queen: [],
      king: [],
    } as unknown as Record<PieceId, Exercise[]>;

    it("eight 1★ exercises earn the badge", () => {
      const stars = Object.fromEntries(
        Array.from({ length: 8 }, (_, i) => [`r${i}`, 1]),
      );
      const completed = completedExerciseCount("rook", stars, catalog);
      expect(isBadgeEarned(completed, catalog.rook.length)).toBe(true);
    });

    it("three 3★ exercises (9★) do NOT earn the badge", () => {
      const stars = { r0: 3, r1: 3, r2: 3 };
      const completed = completedExerciseCount("rook", stars, catalog);
      expect(isBadgeEarned(completed, catalog.rook.length)).toBe(false);
    });
  });
});
