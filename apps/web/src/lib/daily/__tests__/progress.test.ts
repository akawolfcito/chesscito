import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  computeNextProgress,
  getDailyProgress,
  isCompletedToday,
  isStreakLive,
  recordDailyCompletion,
  todayUtc,
  yesterdayUtc,
  type DailyProgress,
} from "../progress";

const STORAGE_KEY = "chesscito:daily-progress";

describe("daily progress — date helpers", () => {
  it("todayUtc returns YYYY-MM-DD for a fixed date", () => {
    expect(todayUtc(new Date("2026-04-25T12:34:56Z"))).toBe("2026-04-25");
  });

  it("yesterdayUtc rolls back one UTC day", () => {
    expect(yesterdayUtc("2026-04-25")).toBe("2026-04-24");
    expect(yesterdayUtc("2026-03-01")).toBe("2026-02-28");
    expect(yesterdayUtc("2026-01-01")).toBe("2025-12-31");
  });
});

describe("daily progress — computeNextProgress (pure)", () => {
  const empty: DailyProgress = { streak: 0, lastCompletedDate: null, totalCompleted: 0 };

  it("first ever completion sets streak to 1", () => {
    const next = computeNextProgress(empty, "2026-04-25");
    expect(next).toEqual({
      streak: 1,
      lastCompletedDate: "2026-04-25",
      totalCompleted: 1,
    });
  });

  it("completing on the next day extends the streak", () => {
    const prev: DailyProgress = { streak: 3, lastCompletedDate: "2026-04-24", totalCompleted: 3 };
    const next = computeNextProgress(prev, "2026-04-25");
    expect(next.streak).toBe(4);
    expect(next.lastCompletedDate).toBe("2026-04-25");
    expect(next.totalCompleted).toBe(4);
  });

  it("completing after a gap resets streak to 1 but preserves total", () => {
    const prev: DailyProgress = { streak: 7, lastCompletedDate: "2026-04-20", totalCompleted: 12 };
    const next = computeNextProgress(prev, "2026-04-25");
    expect(next.streak).toBe(1);
    expect(next.lastCompletedDate).toBe("2026-04-25");
    expect(next.totalCompleted).toBe(13);
  });

  it("completing twice the same day is a no-op (returns same reference)", () => {
    const prev: DailyProgress = { streak: 2, lastCompletedDate: "2026-04-25", totalCompleted: 5 };
    const next = computeNextProgress(prev, "2026-04-25");
    expect(next).toBe(prev);
  });
});

describe("daily progress — localStorage roundtrip", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });

  it("getDailyProgress returns defaults on empty storage", () => {
    expect(getDailyProgress()).toEqual({ streak: 0, lastCompletedDate: null, totalCompleted: 0 });
  });

  it("getDailyProgress recovers gracefully from corrupt JSON", () => {
    localStorage.setItem(STORAGE_KEY, "not-json{{{");
    expect(getDailyProgress()).toEqual({ streak: 0, lastCompletedDate: null, totalCompleted: 0 });
  });

  it("recordDailyCompletion persists and returns new state", () => {
    const result = recordDailyCompletion("2026-04-25");
    expect(result.streak).toBe(1);
    expect(result.lastCompletedDate).toBe("2026-04-25");
    expect(getDailyProgress()).toEqual(result);
  });

  it("recordDailyCompletion is idempotent for the same day", () => {
    recordDailyCompletion("2026-04-25");
    const second = recordDailyCompletion("2026-04-25");
    expect(second.streak).toBe(1);
    expect(second.totalCompleted).toBe(1);
  });

  it("recordDailyCompletion across consecutive days builds a streak", () => {
    recordDailyCompletion("2026-04-23");
    recordDailyCompletion("2026-04-24");
    const result = recordDailyCompletion("2026-04-25");
    expect(result.streak).toBe(3);
    expect(result.totalCompleted).toBe(3);
  });

  it("isCompletedToday reflects the persisted state", () => {
    expect(isCompletedToday("2026-04-25")).toBe(false);
    recordDailyCompletion("2026-04-25");
    expect(isCompletedToday("2026-04-25")).toBe(true);
    expect(isCompletedToday("2026-04-26")).toBe(false);
  });

  it("isStreakLive — true on completion day", () => {
    recordDailyCompletion("2026-04-25");
    expect(isStreakLive("2026-04-25")).toBe(true);
  });

  it("isStreakLive — true on the day after (grace window)", () => {
    recordDailyCompletion("2026-04-24");
    expect(isStreakLive("2026-04-25")).toBe(true);
  });

  it("isStreakLive — false after a missed day", () => {
    recordDailyCompletion("2026-04-23");
    expect(isStreakLive("2026-04-25")).toBe(false);
  });

  it("isStreakLive — false when streak is 0", () => {
    expect(isStreakLive("2026-04-25")).toBe(false);
  });
});
