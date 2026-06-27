import { describe, expect, it } from "vitest";

import { challengeDayFromExpiry } from "@/lib/season-pass/challenge-day";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 5, 27, 12, 0, 0);

describe("challengeDayFromExpiry", () => {
  it("just purchased (21 days left) → Day 1", () => {
    const expiry = new Date(NOW + 21 * DAY).toISOString();
    expect(challengeDayFromExpiry(expiry, 21, NOW)).toBe(1);
  });

  it("mid challenge (11 days left) → Day 11", () => {
    const expiry = new Date(NOW + 11 * DAY).toISOString();
    expect(challengeDayFromExpiry(expiry, 21, NOW)).toBe(11);
  });

  it("last day (1 day left) → Day 21", () => {
    const expiry = new Date(NOW + 1 * DAY).toISOString();
    expect(challengeDayFromExpiry(expiry, 21, NOW)).toBe(21);
  });

  it("clamps below 1 when the clock is skewed past expiry", () => {
    const expiry = new Date(NOW - 2 * DAY).toISOString();
    expect(challengeDayFromExpiry(expiry, 21, NOW)).toBe(21);
  });

  it("clamps above durationDays when more time than the window remains", () => {
    const expiry = new Date(NOW + 40 * DAY).toISOString();
    expect(challengeDayFromExpiry(expiry, 21, NOW)).toBe(1);
  });

  it("invalid / null expiry → Day 1 (safe default)", () => {
    expect(challengeDayFromExpiry(null, 21, NOW)).toBe(1);
    expect(challengeDayFromExpiry("not-a-date", 21, NOW)).toBe(1);
  });
});
