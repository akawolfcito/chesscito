import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_STREAK_NUDGE_STATE,
  STREAK_NUDGE_MAX_SHOWS,
  computeNudgeOwed,
  computeNudgeRetired,
  computeNudgeShown,
  getStreakNudgeState,
  recordStreakNudgeOwed,
  recordStreakNudgeShown,
  retireStreakNudge,
  shouldShowStreakNudge,
  type StreakNudgeState,
} from "../streak-nudge";

const TODAY = "2026-07-27";
const YESTERDAY = "2026-07-26";

function state(overrides: Partial<StreakNudgeState> = {}): StreakNudgeState {
  return { ...DEFAULT_STREAK_NUDGE_STATE, ...overrides };
}

describe("computeNudgeOwed — arming", () => {
  it("arms the latch on the 3rd fresh solve of a day with the Daily unsolved", () => {
    const next = computeNudgeOwed(state(), {
      today: TODAY,
      dailySolvedToday: false,
      freshSolvesToday: 3,
    });

    expect(next.owedForDate).toBe(TODAY);
  });

  it.each([1, 2, 4, 5])("does not arm on solve %i", (freshSolvesToday) => {
    const next = computeNudgeOwed(state(), {
      today: TODAY,
      dailySolvedToday: false,
      freshSolvesToday,
    });

    expect(next.owedForDate).toBeNull();
  });

  it("does not arm at zero solves, which is 0 % 3 and would otherwise pass", () => {
    const next = computeNudgeOwed(state(), {
      today: TODAY,
      dailySolvedToday: false,
      freshSolvesToday: 0,
    });

    expect(next.owedForDate).toBeNull();
  });

  it("does not arm when the Daily is already solved today", () => {
    const next = computeNudgeOwed(state(), {
      today: TODAY,
      dailySolvedToday: true,
      freshSolvesToday: 3,
    });

    expect(next.owedForDate).toBeNull();
  });

  it("does not arm once the lifetime cap is spent", () => {
    const next = computeNudgeOwed(state({ shownCount: STREAK_NUDGE_MAX_SHOWS }), {
      today: TODAY,
      dailySolvedToday: false,
      freshSolvesToday: 3,
    });

    expect(next.owedForDate).toBeNull();
  });

  it("does not arm when it already showed today", () => {
    const next = computeNudgeOwed(state({ shownCount: 1, lastShownDate: TODAY }), {
      today: TODAY,
      dailySolvedToday: false,
      freshSolvesToday: 3,
    });

    expect(next.owedForDate).toBeNull();
  });

  it("does not arm once retired", () => {
    const next = computeNudgeOwed(state({ retired: true }), {
      today: TODAY,
      dailySolvedToday: false,
      freshSolvesToday: 3,
    });

    expect(next.owedForDate).toBeNull();
  });

  it("arms again on solve 6 when solve 3 armed but was never paid", () => {
    const armed = state({ owedForDate: TODAY });
    const next = computeNudgeOwed(armed, {
      today: TODAY,
      dailySolvedToday: false,
      freshSolvesToday: 6,
    });

    expect(next).toBe(armed);
  });

  it("returns prev by reference when nothing changes", () => {
    const prev = state();
    const next = computeNudgeOwed(prev, {
      today: TODAY,
      dailySolvedToday: false,
      freshSolvesToday: 2,
    });

    expect(next).toBe(prev);
  });

  it("replaces a latch owed for a previous day rather than carrying it", () => {
    const stale = state({ owedForDate: YESTERDAY });
    const next = computeNudgeOwed(stale, {
      today: TODAY,
      dailySolvedToday: false,
      freshSolvesToday: 3,
    });

    expect(next.owedForDate).toBe(TODAY);
  });

  it("leaves a stale latch alone when today does not qualify, because paying checks the date", () => {
    const stale = state({ owedForDate: YESTERDAY });
    const next = computeNudgeOwed(stale, {
      today: TODAY,
      dailySolvedToday: false,
      freshSolvesToday: 2,
    });

    expect(next).toBe(stale);
  });
});

describe("shouldShowStreakNudge — paying", () => {
  it("shows when the latch is owed for today", () => {
    expect(
      shouldShowStreakNudge({
        state: state({ owedForDate: TODAY }),
        today: TODAY,
        dailySolvedToday: false,
      }),
    ).toBe(true);
  });

  it("does not show without a latch", () => {
    expect(
      shouldShowStreakNudge({ state: state(), today: TODAY, dailySolvedToday: false }),
    ).toBe(false);
  });

  it("never pays a latch armed yesterday", () => {
    expect(
      shouldShowStreakNudge({
        state: state({ owedForDate: YESTERDAY }),
        today: TODAY,
        dailySolvedToday: false,
      }),
    ).toBe(false);
  });

  it("does not show when the Daily was solved between arming and leaving", () => {
    expect(
      shouldShowStreakNudge({
        state: state({ owedForDate: TODAY }),
        today: TODAY,
        dailySolvedToday: true,
      }),
    ).toBe(false);
  });

  it("does not show a second time on the same day", () => {
    expect(
      shouldShowStreakNudge({
        state: state({ owedForDate: TODAY, lastShownDate: TODAY, shownCount: 1 }),
        today: TODAY,
        dailySolvedToday: false,
      }),
    ).toBe(false);
  });

  it("does not show once the lifetime cap is spent", () => {
    expect(
      shouldShowStreakNudge({
        state: state({ owedForDate: TODAY, shownCount: STREAK_NUDGE_MAX_SHOWS }),
        today: TODAY,
        dailySolvedToday: false,
      }),
    ).toBe(false);
  });

  it("does not show once retired, even with a live latch", () => {
    expect(
      shouldShowStreakNudge({
        state: state({ owedForDate: TODAY, retired: true }),
        today: TODAY,
        dailySolvedToday: false,
      }),
    ).toBe(false);
  });
});

describe("computeNudgeShown", () => {
  it("counts the appearance and stamps the day", () => {
    const next = computeNudgeShown(state({ owedForDate: TODAY }), TODAY);

    expect(next.shownCount).toBe(1);
    expect(next.lastShownDate).toBe(TODAY);
  });

  it("clears the latch it just paid", () => {
    const next = computeNudgeShown(state({ owedForDate: TODAY }), TODAY);

    expect(next.owedForDate).toBeNull();
  });

  it("is idempotent within a day, returning prev by reference", () => {
    const prev = state({ shownCount: 1, lastShownDate: TODAY });

    expect(computeNudgeShown(prev, TODAY)).toBe(prev);
  });

  it("never counts past the lifetime cap", () => {
    const next = computeNudgeShown(
      state({ shownCount: STREAK_NUDGE_MAX_SHOWS, lastShownDate: YESTERDAY }),
      TODAY,
    );

    expect(next.shownCount).toBe(STREAK_NUDGE_MAX_SHOWS);
  });

  it("does not retire on its own — the cap is read, not written", () => {
    const next = computeNudgeShown(state({ shownCount: 2, lastShownDate: YESTERDAY }), TODAY);

    expect(next.retired).toBe(false);
    expect(
      shouldShowStreakNudge({
        state: { ...next, owedForDate: TODAY },
        today: "2026-07-28",
        dailySolvedToday: false,
      }),
    ).toBe(false);
  });
});

describe("computeNudgeRetired", () => {
  it("retires and counts the appearance in one step", () => {
    const next = computeNudgeRetired(state({ owedForDate: TODAY }), TODAY);

    expect(next.retired).toBe(true);
    expect(next.shownCount).toBe(1);
    expect(next.lastShownDate).toBe(TODAY);
  });

  it("stops a later appearance for good", () => {
    const next = computeNudgeRetired(state({ owedForDate: TODAY }), TODAY);

    expect(
      shouldShowStreakNudge({
        state: { ...next, owedForDate: "2026-07-28" },
        today: "2026-07-28",
        dailySolvedToday: false,
      }),
    ).toBe(false);
  });

  it("is idempotent once retired", () => {
    const prev = state({ retired: true, shownCount: 1, lastShownDate: TODAY });

    expect(computeNudgeRetired(prev, TODAY)).toBe(prev);
  });
});

describe("streak nudge — storage", () => {
  const STORAGE_KEY = "chesscito:streak-nudge";

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_STREAK_NUDGE_ENABLED", "true");
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    localStorage.clear();
  });

  it("reads the default state when nothing is stored", () => {
    expect(getStreakNudgeState()).toEqual(DEFAULT_STREAK_NUDGE_STATE);
  });

  it("returns the default and does not throw on a corrupt record", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");

    expect(() => getStreakNudgeState()).not.toThrow();
    expect(getStreakNudgeState()).toEqual(DEFAULT_STREAK_NUDGE_STATE);
  });

  it("clamps a tampered shownCount on READ, so no record buys a 4th appearance", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ shownCount: 99 }));

    expect(getStreakNudgeState().shownCount).toBe(STREAK_NUDGE_MAX_SHOWS);
  });

  it("fails toward showing on garbage fields rather than crashing", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        shownCount: "two",
        lastShownDate: "yesterday",
        owedForDate: 42,
        retired: "yes",
      }),
    );

    expect(getStreakNudgeState()).toEqual(DEFAULT_STREAK_NUDGE_STATE);
  });

  it("persists the armed latch", () => {
    recordStreakNudgeOwed({ today: TODAY, dailySolvedToday: false, freshSolvesToday: 3 });

    expect(getStreakNudgeState().owedForDate).toBe(TODAY);
  });

  it("persists an appearance and clears the latch it paid", () => {
    recordStreakNudgeOwed({ today: TODAY, dailySolvedToday: false, freshSolvesToday: 3 });
    recordStreakNudgeShown(TODAY);

    const stored = getStreakNudgeState();
    expect(stored.shownCount).toBe(1);
    expect(stored.lastShownDate).toBe(TODAY);
    expect(stored.owedForDate).toBeNull();
  });

  it("persists the retirement", () => {
    recordStreakNudgeOwed({ today: TODAY, dailySolvedToday: false, freshSolvesToday: 3 });
    retireStreakNudge(TODAY);

    expect(getStreakNudgeState().retired).toBe(true);
  });

  it("writes nothing at all with the flag off", () => {
    vi.stubEnv("NEXT_PUBLIC_STREAK_NUDGE_ENABLED", "false");

    recordStreakNudgeOwed({ today: TODAY, dailySolvedToday: false, freshSolvesToday: 3 });
    recordStreakNudgeShown(TODAY);
    retireStreakNudge(TODAY);

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("survives a localStorage that refuses to write", () => {
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });

    expect(() =>
      recordStreakNudgeOwed({ today: TODAY, dailySolvedToday: false, freshSolvesToday: 3 }),
    ).not.toThrow();
    expect(() => recordStreakNudgeShown(TODAY)).not.toThrow();

    setItem.mockRestore();
  });

  it("survives a localStorage that refuses to read", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });

    expect(getStreakNudgeState()).toEqual(DEFAULT_STREAK_NUDGE_STATE);

    getItem.mockRestore();
  });
});
