import { describe, expect, it } from "vitest";
import {
  computeAddNetStars,
  netStars,
  parseDailyStars,
  type DailyStarLedger,
} from "@/lib/progression/stars";

describe("netStars", () => {
  it("counts only the improvement over the previous best", () => {
    expect(netStars(1, 3)).toBe(2);
  });

  it("is zero when a replay does not beat the previous best", () => {
    expect(netStars(3, 3)).toBe(0);
  });

  it("is zero when a replay is worse than the previous best", () => {
    expect(netStars(3, 1)).toBe(0);
  });

  it("counts the full result for a never-played exercise", () => {
    expect(netStars(0, 2)).toBe(2);
  });
});

describe("parseDailyStars", () => {
  it("returns a zeroed ledger for a stored date that is not today", () => {
    const raw = JSON.stringify({ date: "2026-07-10", stars: 8 });
    expect(parseDailyStars(raw, "2026-07-11")).toEqual({
      date: "2026-07-11",
      stars: 0,
    });
  });

  it("returns a zeroed ledger for corrupt input", () => {
    expect(parseDailyStars("{{{", "2026-07-11")).toEqual({
      date: "2026-07-11",
      stars: 0,
    });
  });

  it("keeps today's ledger", () => {
    const raw = JSON.stringify({ date: "2026-07-11", stars: 5 });
    expect(parseDailyStars(raw, "2026-07-11")).toEqual({
      date: "2026-07-11",
      stars: 5,
    });
  });
});

describe("computeAddNetStars", () => {
  it("adds the net gain and leaves the reference untouched on a no-op", () => {
    const state: DailyStarLedger = { date: "2026-07-11", stars: 5 };
    expect(computeAddNetStars(state, 0)).toBe(state);
    expect(computeAddNetStars(state, 2)).toEqual({
      date: "2026-07-11",
      stars: 7,
    });
  });
});
