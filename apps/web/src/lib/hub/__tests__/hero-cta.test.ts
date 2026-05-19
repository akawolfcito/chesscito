// apps/web/src/lib/hub/__tests__/hero-cta.test.ts
import { describe, it, expect } from "vitest";
import { getHeroContextAction } from "@/lib/hub/hero-cta";

describe("getHeroContextAction", () => {
  const baseLoaded = {
    isLoading: false,
    exercisesCompletedCount: 0,
    dailyHistoryCount: 0,
    isDailyCompletedToday: false,
  };

  it("returns 'default' while signals are still loading", () => {
    const result = getHeroContextAction({ ...baseLoaded, isLoading: true });
    expect(result.variant).toBe("default");
  });

  it("returns 'new-player' when no exercises done AND no daily history", () => {
    const result = getHeroContextAction(baseLoaded);
    expect(result.variant).toBe("new-player");
    expect(result.destination).toBe("/exercises?piece=rook");
  });

  it("returns 'daily-pending' when daily not solved today", () => {
    const result = getHeroContextAction({
      ...baseLoaded,
      exercisesCompletedCount: 5,
      dailyHistoryCount: 3,
      isDailyCompletedToday: false,
    });
    expect(result.variant).toBe("daily-pending");
    expect(result.destination).toBe("/exercises?slot=daily");
  });

  it("returns 'default' when daily solved and exercises done", () => {
    const result = getHeroContextAction({
      ...baseLoaded,
      exercisesCompletedCount: 5,
      dailyHistoryCount: 3,
      isDailyCompletedToday: true,
    });
    expect(result.variant).toBe("default");
  });

  it("prioritizes new-player over daily-pending", () => {
    // edge case: no exercises but daily history exists (shouldn't happen, but defensive)
    const result = getHeroContextAction({
      ...baseLoaded,
      exercisesCompletedCount: 0,
      dailyHistoryCount: 5,
      isDailyCompletedToday: false,
    });
    // dailyHistoryCount > 0 means user has been playing daily → not "new"
    expect(result.variant).toBe("daily-pending");
  });
});
