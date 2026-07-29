/**
 * Slice 2B — the pure week module (API-1, API-2).
 *
 * Spec: docs/specs/2026-07-29-leaders-weekly-api.md
 *
 * `now` is injected on purpose, so the boundary cases below are ordinary
 * assertions instead of clock mocking. Everything here is UTC: the window is
 * one shared calendar week for every player, not a per-timezone one, and the
 * UI localizes only how the dates are DISPLAYED.
 */

import { describe, expect, it } from "vitest";

import { currentWeekWindow } from "../week-window";

const iso = (d: Date) => d.toISOString();

describe("currentWeekWindow", () => {
  it("returns the same Monday for an instant exactly on Monday 00:00:00 UTC", () => {
    const w = currentWeekWindow(new Date("2026-07-27T00:00:00.000Z"));
    expect(iso(w.start)).toBe("2026-07-27T00:00:00.000Z");
  });

  it("keeps a Monday 23:59:59 inside that same week", () => {
    const w = currentWeekWindow(new Date("2026-07-27T23:59:59.999Z"));
    expect(iso(w.start)).toBe("2026-07-27T00:00:00.000Z");
  });

  it("maps a Sunday 23:59:59 back to the PREVIOUS Monday", () => {
    // The half-open interval's whole point: this instant belongs to the week
    // that started six days ago, not to the one starting in a millisecond.
    const w = currentWeekWindow(new Date("2026-08-02T23:59:59.999Z"));
    expect(iso(w.start)).toBe("2026-07-27T00:00:00.000Z");
    expect(iso(w.end)).toBe("2026-08-03T00:00:00.000Z");
  });

  it("crosses a year boundary without leaving the week", () => {
    // 2027-01-01 is a Friday; its week started on 2026-12-28.
    const w = currentWeekWindow(new Date("2027-01-01T12:00:00.000Z"));
    expect(iso(w.start)).toBe("2026-12-28T00:00:00.000Z");
    expect(iso(w.end)).toBe("2027-01-04T00:00:00.000Z");
  });

  it("is unaffected by a DST transition in the local timezone", () => {
    // 2026-03-29 is the European DST switch AND a Sunday. A implementation
    // built on local getters would land on a different Monday depending on
    // where the server runs; UTC getters cannot.
    const w = currentWeekWindow(new Date("2026-03-29T23:59:59.999Z"));
    expect(iso(w.start)).toBe("2026-03-23T00:00:00.000Z");
    expect(iso(w.end)).toBe("2026-03-30T00:00:00.000Z");
  });

  it("always starts on a Monday at exactly midnight UTC", () => {
    // Every hour of a full week, so no single lucky anchor is carrying the test.
    for (let h = 0; h < 24 * 7; h += 1) {
      const now = new Date(Date.UTC(2026, 6, 27, h, 37, 11, 123));
      const w = currentWeekWindow(now);
      expect(w.start.getUTCDay()).toBe(1);
      expect(w.start.getUTCHours()).toBe(0);
      expect(w.start.getUTCMinutes()).toBe(0);
      expect(w.start.getUTCSeconds()).toBe(0);
      expect(w.start.getUTCMilliseconds()).toBe(0);
    }
  });

  it("contains `now` in the half-open interval, for every hour of a week", () => {
    for (let h = 0; h < 24 * 7; h += 1) {
      const now = new Date(Date.UTC(2026, 6, 27, h, 37, 11, 123));
      const w = currentWeekWindow(now);
      expect(w.start.getTime()).toBeLessThanOrEqual(now.getTime());
      expect(now.getTime()).toBeLessThan(w.end.getTime());
    }
  });

  it("ends exactly 7 days after it starts", () => {
    const w = currentWeekWindow(new Date("2026-07-29T12:00:00.000Z"));
    expect(w.end.getTime() - w.start.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("does not mutate the Date it was given", () => {
    // It would be easy to implement this with setUTCHours on the argument,
    // and the caller passing `new Date()` would never notice.
    const now = new Date("2026-07-29T12:00:00.000Z");
    currentWeekWindow(now);
    expect(iso(now)).toBe("2026-07-29T12:00:00.000Z");
  });
});
