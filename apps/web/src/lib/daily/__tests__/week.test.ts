import { describe, expect, it } from "vitest";

import { focusWeek, type FocusWeekDay } from "../week";

/** Compact readout: "M:state T:state ..." keeps the assertions legible. */
function states(days: FocusWeekDay[]): string[] {
  return days.map((d) => d.state);
}

describe("focusWeek", () => {
  // 2026-07-22 is a UTC Wednesday. Its Monday-first week is 07-20 → 07-26.
  const WED = "2026-07-22";

  it("always returns 7 days, Monday-first, in the UTC week containing today", () => {
    const week = focusWeek(WED, 0, null);
    expect(week).toHaveLength(7);
    expect(week[0].date).toBe("2026-07-20");
    expect(week[6].date).toBe("2026-07-26");
  });

  it("marks days after today as future and today as pending with no completion", () => {
    expect(states(focusWeek(WED, 0, null))).toEqual([
      "missed",
      "missed",
      "today-pending",
      "future",
      "future",
      "future",
      "future",
    ]);
  });

  it("marks today done when the last completion is today", () => {
    const week = focusWeek(WED, 1, WED);
    expect(week[2].state).toBe("today-done");
    expect(week[2].isToday).toBe(true);
  });

  it("paints the streak run backwards from the last completed date", () => {
    // streak 3 ending Wednesday → Mon, Tue completed, Wed done.
    expect(states(focusWeek(WED, 3, WED))).toEqual([
      "completed",
      "completed",
      "today-done",
      "future",
      "future",
      "future",
      "future",
    ]);
  });

  it("keeps today pending when the run ended yesterday", () => {
    expect(states(focusWeek(WED, 2, "2026-07-21"))).toEqual([
      "completed",
      "completed",
      "today-pending",
      "future",
      "future",
      "future",
      "future",
    ]);
  });

  it("does not paint a stale run that ended before this week", () => {
    expect(states(focusWeek(WED, 2, "2026-07-12"))).toEqual([
      "missed",
      "missed",
      "today-pending",
      "future",
      "future",
      "future",
      "future",
    ]);
  });

  it("clamps a run longer than the week without spilling", () => {
    expect(states(focusWeek(WED, 40, WED))).toEqual([
      "completed",
      "completed",
      "today-done",
      "future",
      "future",
      "future",
      "future",
    ]);
  });

  it("treats a negative or fractional streak as no completions", () => {
    expect(states(focusWeek(WED, -5, WED))).toEqual([
      "missed",
      "missed",
      "today-pending",
      "future",
      "future",
      "future",
      "future",
    ]);
  });

  it("handles a UTC Sunday as the LAST slot of the week, not the first", () => {
    // 2026-07-26 is a UTC Sunday.
    const week = focusWeek("2026-07-26", 1, "2026-07-26");
    expect(week[0].date).toBe("2026-07-20");
    expect(week[6].date).toBe("2026-07-26");
    expect(week[6].state).toBe("today-done");
    expect(states(week).filter((s) => s === "future")).toHaveLength(0);
  });

  it("handles a UTC Monday as the first slot with the rest in the future", () => {
    // 2026-07-20 is a UTC Monday.
    expect(states(focusWeek("2026-07-20", 0, null))).toEqual([
      "today-pending",
      "future",
      "future",
      "future",
      "future",
      "future",
      "future",
    ]);
  });

  it("crosses a month boundary backwards without breaking the run", () => {
    // 2026-08-03 is a UTC Monday; a 3-day run ending 2026-08-03 reaches into July.
    const week = focusWeek("2026-08-05", 3, "2026-08-05");
    expect(week[0].date).toBe("2026-08-03");
    expect(states(week).slice(0, 3)).toEqual(["completed", "completed", "today-done"]);
  });

  it("never reports a future day as missed", () => {
    const week = focusWeek(WED, 0, null);
    expect(week.slice(3).every((d) => d.state === "future")).toBe(true);
  });
});
