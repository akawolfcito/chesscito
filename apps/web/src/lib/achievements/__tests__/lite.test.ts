import { describe, it, expect } from "vitest";
import { deriveLiteAchievements } from "../lite";
import type { DailyProgress } from "@/lib/daily/progress";

function progress(overrides: Partial<DailyProgress> = {}): DailyProgress {
  return { streak: 0, lastCompletedDate: null, totalCompleted: 0, ...overrides };
}

describe("deriveLiteAchievements", () => {
  it("returns 3 achievements, all unearned, when totalCompleted=0 streak=0", () => {
    const result = deriveLiteAchievements(progress());
    expect(result).toHaveLength(3);
    expect(result.every((a) => !a.earned)).toBe(true);
    expect(result.map((a) => a.id)).toEqual([
      "first-focus-day",
      "three-day-rhythm",
      "seven-day-focus",
    ]);
  });

  it("earns only first-focus-day when totalCompleted=1 streak=1", () => {
    const result = deriveLiteAchievements(progress({ totalCompleted: 1, streak: 1 }));
    expect(result.find((a) => a.id === "first-focus-day")?.earned).toBe(true);
    expect(result.find((a) => a.id === "three-day-rhythm")?.earned).toBe(false);
    expect(result.find((a) => a.id === "seven-day-focus")?.earned).toBe(false);
  });

  it("earns first-focus-day + 3-day-rhythm when streak=3", () => {
    const result = deriveLiteAchievements(progress({ totalCompleted: 3, streak: 3 }));
    expect(result.find((a) => a.id === "first-focus-day")?.earned).toBe(true);
    expect(result.find((a) => a.id === "three-day-rhythm")?.earned).toBe(true);
    expect(result.find((a) => a.id === "seven-day-focus")?.earned).toBe(false);
  });

  it("earns all 3 when streak=7", () => {
    const result = deriveLiteAchievements(progress({ totalCompleted: 7, streak: 7 }));
    expect(result.every((a) => a.earned)).toBe(true);
    expect(result.every((a) => a.progress === undefined)).toBe(true);
  });

  it("earns all 3 when streak=10 (no overflow, progress undefined when earned)", () => {
    const result = deriveLiteAchievements(progress({ totalCompleted: 10, streak: 10 }));
    expect(result.every((a) => a.earned)).toBe(true);
    expect(result.every((a) => a.progress === undefined)).toBe(true);
  });

  it("shows correct progress bars for each unearned achievement", () => {
    const result = deriveLiteAchievements(progress({ totalCompleted: 0, streak: 2 }));
    expect(result.find((a) => a.id === "first-focus-day")?.progress).toEqual({ current: 0, goal: 1 });
    expect(result.find((a) => a.id === "three-day-rhythm")?.progress).toEqual({ current: 2, goal: 3 });
    expect(result.find((a) => a.id === "seven-day-focus")?.progress).toEqual({ current: 2, goal: 7 });
  });

  it("clamps progress.current to the goal maximum when unearned", () => {
    // streak=6 → three-day-rhythm earned, seven-day-focus not earned yet; progress capped at 7
    const result = deriveLiteAchievements(progress({ totalCompleted: 6, streak: 6 }));
    const weekFocus = result.find((a) => a.id === "seven-day-focus");
    expect(weekFocus?.earned).toBe(false);
    expect(weekFocus?.progress).toEqual({ current: 6, goal: 7 });
  });

  describe("copy guard — no prohibited terms in IDs", () => {
    it("IDs contain no on-chain / medical jargon", () => {
      const result = deriveLiteAchievements(progress());
      const prohibited = ["verified", "on-chain", "proof", "nft", "mint", "brain", "memory", "focus-improves"];
      for (const a of result) {
        for (const term of prohibited) {
          expect(a.id.toLowerCase()).not.toContain(term);
        }
      }
    });
  });
});
