import { describe, expect, it } from "vitest";
import { daysRemaining } from "@/lib/pro/days-remaining";

const NOW = new Date("2026-06-01T12:00:00.000Z").getTime();
const MS_PER_DAY = 86_400_000;

describe("daysRemaining", () => {
  it("returns null for null timestamp", () => {
    expect(daysRemaining(null, NOW)).toBeNull();
  });

  it("returns null for undefined timestamp", () => {
    expect(daysRemaining(undefined, NOW)).toBeNull();
  });

  it("returns null for NaN timestamp", () => {
    expect(daysRemaining(Number.NaN, NOW)).toBeNull();
  });

  it("returns null for Infinity timestamp", () => {
    expect(daysRemaining(Number.POSITIVE_INFINITY, NOW)).toBeNull();
  });

  it("returns null when expiresAt equals now", () => {
    expect(daysRemaining(NOW, NOW)).toBeNull();
  });

  it("returns null when expiresAt is in the past", () => {
    expect(daysRemaining(NOW - MS_PER_DAY, NOW)).toBeNull();
  });

  it("returns 1 for any expiry within the next 24h", () => {
    expect(daysRemaining(NOW + 1, NOW)).toBe(1);
    expect(daysRemaining(NOW + MS_PER_DAY - 1, NOW)).toBe(1);
  });

  it("returns 1 at exactly +1 day (ceil semantics)", () => {
    expect(daysRemaining(NOW + MS_PER_DAY, NOW)).toBe(1);
  });

  it("returns 2 at +1 day + 1ms", () => {
    expect(daysRemaining(NOW + MS_PER_DAY + 1, NOW)).toBe(2);
  });

  it("returns 30 for a fresh 30-day pass", () => {
    expect(daysRemaining(NOW + 30 * MS_PER_DAY, NOW)).toBe(30);
  });

  it("rounds up partial days", () => {
    expect(daysRemaining(NOW + 5 * MS_PER_DAY + 1_000, NOW)).toBe(6);
  });
});
