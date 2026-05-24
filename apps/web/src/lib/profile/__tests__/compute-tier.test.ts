import { describe, it, expect } from "vitest";
import { computeTier } from "@/lib/profile/compute-tier";

describe("computeTier", () => {
  const baseStats = {
    puzzlesSolved: 0,
    piecesMastered: 0,
    arenaWins: 0,
    daysStreak: 0,
    address: "0x1234" as `0x${string}`,
  };

  it("returns visitor key when address is undefined", () => {
    const result = computeTier({ ...baseStats, address: undefined });
    expect(result.tier).toBe("visitor");
    expect(result.xp).toBe(0);
    // `title` was dropped from the return shape — callers now resolve
    // `t(\`tierLabels.${tier}\`)` themselves so the helper stays
    // locale-agnostic.
    expect((result as { title?: string }).title).toBeUndefined();
  });

  it("returns apprentice at 0 puzzles solved with address present", () => {
    const result = computeTier(baseStats);
    expect(result.tier).toBe("apprentice");
  });

  it("returns Trainee at 25 puzzles solved", () => {
    const result = computeTier({ ...baseStats, puzzlesSolved: 25 });
    expect(result.tier).toBe("trainee");
  });

  it("returns Knight at 75 puzzles solved", () => {
    const result = computeTier({ ...baseStats, puzzlesSolved: 75 });
    expect(result.tier).toBe("knight");
  });

  it("returns Wizard at 200 puzzles solved", () => {
    const result = computeTier({ ...baseStats, puzzlesSolved: 200 });
    expect(result.tier).toBe("wizard");
  });

  it("returns Grandmaster at 500 puzzles solved", () => {
    const result = computeTier({ ...baseStats, puzzlesSolved: 500 });
    expect(result.tier).toBe("grandmaster");
  });

  it("XP scales with all 4 inputs (puzzles × 10 + pieces × 25 + arena × 15 + streak × 5)", () => {
    const result = computeTier({
      ...baseStats,
      puzzlesSolved: 50,   // 500
      piecesMastered: 3,    // 75
      arenaWins: 12,        // 180
      daysStreak: 14,       // 70
    });
    expect(result.xp).toBe(825);
  });

  it("handles negative or NaN inputs as 0 (defensive)", () => {
    const result = computeTier({
      ...baseStats,
      puzzlesSolved: -5,
      piecesMastered: NaN,
    });
    expect(result.xp).toBe(0);
  });
});
