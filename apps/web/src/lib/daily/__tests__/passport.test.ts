import { describe, expect, it } from "vitest";

import type { DailyProgress } from "@/lib/daily/progress";
import {
  PASSPORT_TOTAL_SLOTS,
  derivePassportView,
  passportFilledSlots,
  passportTier,
} from "@/lib/daily/passport";

const TODAY = "2026-06-20";

function progress(partial: Partial<DailyProgress>): DailyProgress {
  return { streak: 0, lastCompletedDate: null, totalCompleted: 0, ...partial };
}

describe("passportFilledSlots", () => {
  it.each([
    [0, 0],
    [1, 1],
    [3, 3],
    [7, 7],
    [10, 7],
    [-2, 0],
  ])("streak %i → %i filled slots (cap 7, floor 0)", (streak, expected) => {
    expect(passportFilledSlots(streak)).toBe(expected);
  });
});

describe("passportTier", () => {
  it.each([
    [0, "empty"],
    [1, "day1"],
    [2, "building"],
    [6, "building"],
    [7, "week"],
    [12, "week"],
  ])("streak %i → tier %s", (streak, expected) => {
    expect(passportTier(streak)).toBe(expected);
  });
});

describe("derivePassportView", () => {
  it("exposes 7 total slots", () => {
    expect(PASSPORT_TOTAL_SLOTS).toBe(7);
    expect(derivePassportView(progress({ streak: 0 }), TODAY).totalSlots).toBe(7);
  });

  it("streak 0 → 0 filled, empty tier", () => {
    const v = derivePassportView(progress({ streak: 0 }), TODAY);
    expect(v.filledSlots).toBe(0);
    expect(v.tier).toBe("empty");
  });

  it("streak 3 → 3 filled, building tier", () => {
    const v = derivePassportView(progress({ streak: 3 }), TODAY);
    expect(v.filledSlots).toBe(3);
    expect(v.tier).toBe("building");
  });

  it("streak 10 → caps at 7 filled, week tier", () => {
    const v = derivePassportView(progress({ streak: 10 }), TODAY);
    expect(v.filledSlots).toBe(7);
    expect(v.tier).toBe("week");
  });

  it("todayDone true when lastCompletedDate === today", () => {
    const v = derivePassportView(
      progress({ streak: 2, lastCompletedDate: TODAY }),
      TODAY,
    );
    expect(v.todayDone).toBe(true);
  });

  it("todayDone false when lastCompletedDate is older or null", () => {
    expect(
      derivePassportView(
        progress({ streak: 2, lastCompletedDate: "2026-06-19" }),
        TODAY,
      ).todayDone,
    ).toBe(false);
    expect(derivePassportView(progress({ streak: 0 }), TODAY).todayDone).toBe(false);
  });
});
