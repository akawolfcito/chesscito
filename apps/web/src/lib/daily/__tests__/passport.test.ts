import { describe, expect, it } from "vitest";

import type { DailyProgress } from "@/lib/daily/progress";
import {
  PASSPORT_TOTAL_SLOTS,
  derivePassportView,
  passportFilledSlots,
  passportSlots,
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

  it("includes 7 slot descriptors", () => {
    expect(derivePassportView(progress({ streak: 3 }), TODAY).slots).toHaveLength(7);
  });
});

describe("passportSlots", () => {
  const kinds = (filled: number, todayDone: boolean) =>
    passportSlots(filled, todayDone).map((s) => s.kind);

  it("streak 0, today pending → all gray, first slot glows (active)", () => {
    const slots = passportSlots(0, false);
    expect(slots.map((s) => s.kind)).toEqual(Array(7).fill("gray"));
    expect(slots[0].glow).toBe(true);
    expect(slots.slice(1).every((s) => !s.glow)).toBe(true);
  });

  it("streak 1, todayDone → 1 color flame, rest gray, no glow", () => {
    const slots = passportSlots(1, true);
    expect(slots[0].kind).toBe("color");
    expect(slots.slice(1).map((s) => s.kind)).toEqual(Array(6).fill("gray"));
    expect(slots.every((s) => !s.glow)).toBe(true);
  });

  it("streak 3, todayDone → 2 blue + current color + 4 gray", () => {
    expect(kinds(3, true)).toEqual([
      "blue",
      "blue",
      "color",
      "gray",
      "gray",
      "gray",
      "gray",
    ]);
  });

  it("streak 3, today pending → 3 blue + next gray(glow) + rest gray", () => {
    const slots = passportSlots(3, false);
    expect(slots.map((s) => s.kind)).toEqual([
      "blue",
      "blue",
      "blue",
      "gray",
      "gray",
      "gray",
      "gray",
    ]);
    expect(slots[3].glow).toBe(true);
  });

  it("streak 7+, todayDone → 6 blue + last color (caps at 7)", () => {
    expect(kinds(7, true)).toEqual([
      "blue",
      "blue",
      "blue",
      "blue",
      "blue",
      "blue",
      "color",
    ]);
  });
});
