import { describe, expect, it } from "vitest";

import {
  backfillDates,
  challengeProgressView,
  elapsedEligibleDays,
  focusDaysProgress,
  isEligibleFocusDate,
  isUnreachable,
  passWindowStartUtc,
} from "@/lib/season-pass/focus-days";

describe("isEligibleFocusDate", () => {
  const NOW = Date.parse("2026-07-27T12:00:00.000Z");
  /** 21-day pass bought on 2026-07-23. */
  const EXPIRES = "2026-08-13T00:00:00.000Z";
  const pass = (date: string, overrides: Record<string, unknown> = {}) =>
    isEligibleFocusDate({
      date,
      now: NOW,
      source: "season_pass",
      windowStartUtc: "2026-07-23",
      expiresAt: EXPIRES,
      proExpiresAt: null,
      ...overrides,
    });

  it("accepts today", () => {
    expect(pass("2026-07-27")).toBe(true);
  });

  it("accepts yesterday, so a midnight crossing is recoverable", () => {
    expect(pass("2026-07-26")).toBe(true);
  });

  it("rejects two days ago", () => {
    expect(pass("2026-07-25")).toBe(false);
  });

  it("rejects the future", () => {
    expect(pass("2026-07-28")).toBe(false);
  });

  it("rejects a malformed date", () => {
    expect(pass("27-07-2026")).toBe(false);
    expect(pass("2026-13-40")).toBe(false);
    expect(pass("")).toBe(false);
  });

  it("rejects a date before the pass opened", () => {
    // Window opens today, so yesterday predates the purchase.
    expect(pass("2026-07-26", { windowStartUtc: "2026-07-27" })).toBe(false);
  });

  it("rejects a date after the pass expired", () => {
    expect(pass("2026-07-27", { expiresAt: "2026-07-26T00:00:00.000Z" })).toBe(false);
  });

  it("rejects a buyer with no window at all", () => {
    expect(pass("2026-07-27", { windowStartUtc: null, expiresAt: null })).toBe(false);
  });

  // PRO has no purchased window: rules 3 and 4 have nothing to test against.
  // What remains is that PRO had not already lapsed before that date.
  it("accepts a PRO date inside its coverage", () => {
    expect(
      pass("2026-07-26", {
        source: "pro",
        windowStartUtc: null,
        expiresAt: null,
        proExpiresAt: Date.parse("2026-08-01T00:00:00.000Z"),
      }),
    ).toBe(true);
  });

  it("accepts yesterday for a PRO that lapses today", () => {
    expect(
      pass("2026-07-26", {
        source: "pro",
        windowStartUtc: null,
        expiresAt: null,
        proExpiresAt: Date.parse("2026-07-27T06:00:00.000Z"),
      }),
    ).toBe(true);
  });

  it("rejects a date the PRO had already lapsed before", () => {
    expect(
      pass("2026-07-27", {
        source: "pro",
        windowStartUtc: null,
        expiresAt: null,
        proExpiresAt: Date.parse("2026-07-26T23:00:00.000Z"),
      }),
    ).toBe(false);
  });
});

describe("passWindowStartUtc", () => {
  it("derives the opening date from the expiry", () => {
    expect(passWindowStartUtc("2026-08-13T00:00:00.000Z", 21)).toBe("2026-07-23");
  });

  it("has no opening date without an expiry (PRO)", () => {
    expect(passWindowStartUtc(null, 21)).toBeNull();
  });

  it("has no opening date when the expiry is unparseable", () => {
    expect(passWindowStartUtc("not-a-date", 21)).toBeNull();
  });
});

/** Spec: docs/specs/2026-07-27-focus-days-ledger.md (APPROVED). */

const GOAL = 21;

describe("focusDaysProgress", () => {
  it("clamps completed to the goal", () => {
    expect(focusDaysProgress(25, GOAL)).toEqual({ completed: 21, goal: 21 });
  });

  it("never reports a negative count", () => {
    expect(focusDaysProgress(-3, GOAL)).toEqual({ completed: 0, goal: 21 });
  });
});

describe("isUnreachable", () => {
  it("is true when fewer days remain than days still owed", () => {
    // 12 done, 9 owed, only 4 days left.
    expect(
      isUnreachable({ completed: 12, goal: GOAL }, { kind: "expiring", daysRemaining: 4 }),
    ).toBe(true);
  });

  it("is false when the goal still fits in the window", () => {
    expect(
      isUnreachable({ completed: 12, goal: GOAL }, { kind: "expiring", daysRemaining: 9 }),
    ).toBe(false);
  });

  it("is never true without a window: PRO has no deadline to miss", () => {
    expect(isUnreachable({ completed: 0, goal: GOAL }, { kind: "unbounded" })).toBe(false);
  });

  it("is false once the goal is met, whatever the window says", () => {
    expect(
      isUnreachable({ completed: 21, goal: GOAL }, { kind: "expiring", daysRemaining: 0 }),
    ).toBe(false);
  });
});

describe("elapsedEligibleDays", () => {
  const day = (iso: string) => Date.parse(`${iso}T12:00:00.000Z`);

  it("counts a just-purchased pass as one day lived", () => {
    // Bought today → expires in 21 days.
    expect(elapsedEligibleDays("2026-08-18T00:00:00.000Z", 21, day("2026-07-28"))).toBe(1);
  });

  it("counts days already lived, not days remaining", () => {
    // Window opened 2026-07-18, today is the 28th → 11 days lived.
    expect(elapsedEligibleDays("2026-08-08T00:00:00.000Z", 21, day("2026-07-28"))).toBe(11);
  });

  it("never exceeds the goal", () => {
    expect(elapsedEligibleDays("2026-07-29T00:00:00.000Z", 21, day("2026-09-30"))).toBe(21);
  });

  it("is zero without an expiry: nothing can be inferred", () => {
    expect(elapsedEligibleDays(null, 21, day("2026-07-28"))).toBe(0);
    expect(elapsedEligibleDays("not-a-date", 21, day("2026-07-28"))).toBe(0);
  });
});

describe("backfillDates", () => {
  const base = {
    goal: GOAL,
    // Pass bought 2026-07-18, so the window opens there.
    windowStartUtc: "2026-07-18",
    todayUtc: "2026-07-28",
  };

  it("seeds consecutive days back from the last completion", () => {
    expect(
      backfillDates({ ...base, reportedStreak: 3, lastCompletedDate: "2026-07-28", elapsed: 11 }),
    ).toEqual(["2026-07-26", "2026-07-27", "2026-07-28"]);
  });

  it("clips a streak that started before the pass was bought", () => {
    // 10-day streak, but the pass only opened on the 18th.
    const dates = backfillDates({
      ...base,
      reportedStreak: 10,
      lastCompletedDate: "2026-07-20",
      elapsed: 11,
    });
    expect(dates[0]).toBe("2026-07-18");
    expect(dates).toHaveLength(3);
  });

  it("never seeds more than the days the pass has been alive", () => {
    const dates = backfillDates({
      ...base,
      reportedStreak: 21,
      lastCompletedDate: "2026-07-28",
      elapsed: 4,
    });
    expect(dates).toHaveLength(4);
  });

  it("never seeds past the goal", () => {
    const dates = backfillDates({
      ...base,
      windowStartUtc: "2026-01-01",
      reportedStreak: 40,
      lastCompletedDate: "2026-07-28",
      elapsed: 21,
    });
    expect(dates).toHaveLength(21);
  });

  it("seeds nothing for a zero streak, which is a legitimate answer", () => {
    expect(
      backfillDates({ ...base, reportedStreak: 0, lastCompletedDate: null, elapsed: 11 }),
    ).toEqual([]);
  });

  it("seeds nothing when the last completion is unknown", () => {
    expect(
      backfillDates({ ...base, reportedStreak: 5, lastCompletedDate: null, elapsed: 11 }),
    ).toEqual([]);
  });

  it("never seeds a future date", () => {
    const dates = backfillDates({
      ...base,
      reportedStreak: 3,
      lastCompletedDate: "2026-08-05",
      elapsed: 11,
    });
    expect(dates.every((d) => d <= base.todayUtc)).toBe(true);
  });
});

describe("challengeProgressView", () => {
  const window = { kind: "expiring", daysRemaining: 9 } as const;

  it("reports progress from the ledger, never from the streak", () => {
    const view = challengeProgressView({
      slice: { status: "ok", completed: 12, goal: GOAL, seasonId: "s1" },
      window,
      streak: 4,
    });
    expect(view).toEqual({
      state: "active",
      progress: { completed: 12, goal: 21 },
      window,
      streak: 4,
      unreachable: false,
    });
  });

  it("does not fall back to the streak when the ledger is unavailable", () => {
    const view = challengeProgressView({
      slice: { status: "unavailable" },
      window,
      streak: 4,
    });
    expect(view).toEqual({ state: "degraded", window, streak: 4 });
    expect(JSON.stringify(view)).not.toContain("completed");
  });

  it("separates a disabled feature from a broken ledger", () => {
    expect(
      challengeProgressView({ slice: { status: "disabled" }, window, streak: 4 }),
    ).toEqual({ state: "disabled", window, streak: 4 });
  });

  it("completes at the goal even with days left on the pass", () => {
    const view = challengeProgressView({
      slice: { status: "ok", completed: 21, goal: GOAL, seasonId: "s1" },
      window: { kind: "expiring", daysRemaining: 5 },
      streak: 21,
    });
    expect(view.state).toBe("completed");
  });

  it("flags an unreachable goal without hiding the progress earned", () => {
    const view = challengeProgressView({
      slice: { status: "ok", completed: 12, goal: GOAL, seasonId: "s1" },
      window: { kind: "expiring", daysRemaining: 4 },
      streak: 2,
    });
    expect(view).toMatchObject({ state: "active", unreachable: true });
    expect(view).toMatchObject({ progress: { completed: 12 } });
  });
});
