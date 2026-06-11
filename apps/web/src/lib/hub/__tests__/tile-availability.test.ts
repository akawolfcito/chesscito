import { describe, expect, it } from "vitest";

import {
  cooldownLabel,
  dailyAvailability,
  hoursUntilNextUtcDay,
} from "@/lib/hub/tile-availability";

describe("dailyAvailability — pure, mount-time computation", () => {
  it("not completed → ready", () => {
    expect(dailyAvailability(false)).toEqual({ state: "ready" });
  });

  it("completed with few hours left → next with ceiled hours", () => {
    // 18:30 UTC → 5.5h left → ceil 6
    const now = new Date(Date.UTC(2026, 5, 11, 18, 30, 0));
    expect(dailyAvailability(true, now)).toEqual({ state: "next", hours: 6 });
  });

  it("completed early in the day → tomorrow (fuzzy beats 'Next 19h')", () => {
    const now = new Date(Date.UTC(2026, 5, 11, 5, 0, 0)); // 19h left
    expect(dailyAvailability(true, now)).toEqual({ state: "tomorrow" });
  });

  it("boundary: just before reset still says next 1h, never 0h", () => {
    const now = new Date(Date.UTC(2026, 5, 11, 23, 59, 0));
    expect(dailyAvailability(true, now)).toEqual({ state: "next", hours: 1 });
  });

  it("hoursUntilNextUtcDay never returns negative", () => {
    const exactlyMidnight = new Date(Date.UTC(2026, 5, 12, 0, 0, 0));
    expect(hoursUntilNextUtcDay(exactlyMidnight)).toBeGreaterThanOrEqual(0);
  });
});

describe("cooldownLabel — compact one-line copy", () => {
  it("ready renders no text (dot carries it)", () => {
    expect(cooldownLabel({ state: "ready" })).toBeNull();
  });
  it("next → 'Next Xh'", () => {
    expect(cooldownLabel({ state: "next", hours: 6 })).toBe("Next 6h");
  });
  it("tomorrow → 'Tomorrow'", () => {
    expect(cooldownLabel({ state: "tomorrow" })).toBe("Tomorrow");
  });
});
