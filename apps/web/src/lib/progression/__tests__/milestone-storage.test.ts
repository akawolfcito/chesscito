import { describe, expect, it, vi } from "vitest";
import {
  computeMarkCelebrated,
  computeMarkOpened,
  computeRecordEarned,
  markCelebrated,
  parseMilestoneStore,
  recordEarned,
  selectPending,
} from "@/lib/progression/milestone-storage";
import { EMPTY_STORE, type MilestoneStore } from "@/lib/progression/types";
import { milestoneStorageKey } from "@/lib/lite-progress-storage";

const NOW = "2026-07-11T10:00:00.000Z";
const TODAY = "2026-07-11";

describe("parseMilestoneStore", () => {
  it("stamps dailyDate on a fresh store instead of leaving it null — a null "
    + "dailyDate makes the very next daily-reset wipe an event that was just "
    + "recorded but never celebrated", () => {
    expect(parseMilestoneStore(null, TODAY)).toEqual({
      ...EMPTY_STORE,
      dailyDate: TODAY,
    });
  });

  it("returns an empty store stamped with today for corrupt JSON", () => {
    expect(parseMilestoneStore("{{{", TODAY)).toEqual({
      ...EMPTY_STORE,
      dailyDate: TODAY,
    });
  });

  it("does not throw on JSON.parse(\"null\") and returns a stamped empty store", () => {
    expect(parseMilestoneStore("null", TODAY)).toEqual({
      ...EMPTY_STORE,
      dailyDate: TODAY,
    });
  });

  it("does not throw on a bad shape (array) and returns a stamped empty store", () => {
    expect(parseMilestoneStore("[1,2,3]", TODAY)).toEqual({
      ...EMPTY_STORE,
      dailyDate: TODAY,
    });
  });

  it("drops a partially-written entry instead of surviving into selectPending "
    + "and crashing on event.celebratedAt", () => {
    const raw = JSON.stringify({
      version: 1,
      dailyDate: TODAY,
      events: { "first-reward": null },
    });
    const parsed = parseMilestoneStore(raw, TODAY);
    expect(parsed.events["first-reward"]).toBeUndefined();
    expect(() => selectPending(parsed)).not.toThrow();
  });

  it("drops an entry missing a string id or earnedAt", () => {
    const raw = JSON.stringify({
      version: 1,
      dailyDate: TODAY,
      events: {
        "bad-1": { id: "first-reward" }, // missing earnedAt
        "bad-2": { earnedAt: NOW }, // missing id
        "bad-3": "not-an-object",
        "good": { id: "first-reward", earnedAt: NOW },
      },
    });
    const parsed = parseMilestoneStore(raw, TODAY);
    expect(Object.keys(parsed.events)).toEqual(["good"]);
  });

  it("regression: great-focus-session survives a record → celebrate → "
    + "re-read round trip on the SAME day instead of celebrating twice", () => {
    // recordEarned/markCelebrated read the store through
    // parseMilestoneStore's default `today = todayUtc()`, i.e. the REAL
    // clock — they take no `today` param of their own. Freeze the clock to
    // NOW so the `dailyDate` they persist matches the hardcoded TODAY this
    // test re-parses with below; otherwise this test is only correct on
    // 2026-07-11 UTC and silently starts failing the day after (the
    // mismatch triggers the daily reset and wipes the very event under
    // test before the assertion runs).
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
    try {
      localStorage.clear();
      recordEarned([{ id: "great-focus-session" }], NOW);
      markCelebrated("great-focus-session", undefined, NOW);
      const reread = parseMilestoneStore(
        localStorage.getItem(milestoneStorageKey()),
        TODAY,
      );
      expect(reread.events["great-focus-session"]?.celebratedAt).toBe(NOW);
      expect(selectPending(reread)).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("deletes a hypothetical per-piece daily entry by id-prefix, not just "
    + "the bare key", () => {
    const stored: MilestoneStore = {
      version: 1,
      dailyDate: "2026-07-10",
      events: {
        "great-focus-session:rook": {
          id: "great-focus-session",
          piece: "rook",
          earnedAt: "2026-07-10T09:00:00.000Z",
        },
      },
    };
    const parsed = parseMilestoneStore(JSON.stringify(stored), TODAY);
    expect(parsed.events["great-focus-session:rook"]).toBeUndefined();
  });

  it("clears daily milestones when the stored date is not today", () => {
    const stored: MilestoneStore = {
      version: 1,
      dailyDate: "2026-07-10",
      events: {
        "great-focus-session": {
          id: "great-focus-session",
          earnedAt: "2026-07-10T09:00:00.000Z",
          celebratedAt: "2026-07-10T09:00:00.000Z",
        },
        "first-reward": { id: "first-reward", earnedAt: "2026-07-10T08:00:00.000Z" },
      },
    };
    const parsed = parseMilestoneStore(JSON.stringify(stored), TODAY);
    expect(parsed.events["great-focus-session"]).toBeUndefined();
    expect(parsed.events["first-reward"]).toBeDefined();
    expect(parsed.dailyDate).toBe(TODAY);
  });

  it("keeps first-great-session across days — it never resets", () => {
    const stored: MilestoneStore = {
      version: 1,
      dailyDate: "2026-07-10",
      events: {
        "first-great-session": {
          id: "first-great-session",
          earnedAt: "2026-07-10T09:00:00.000Z",
        },
      },
    };
    const parsed = parseMilestoneStore(JSON.stringify(stored), TODAY);
    expect(parsed.events["first-great-session"]).toBeDefined();
  });
});

describe("computeRecordEarned", () => {
  it("records a new event with its earnedAt", () => {
    const next = computeRecordEarned(EMPTY_STORE, [{ id: "first-reward" }], NOW);
    expect(next.events["first-reward"]).toEqual({
      id: "first-reward",
      earnedAt: NOW,
    });
  });

  it("scopes per-piece events by their idempotency key", () => {
    const next = computeRecordEarned(
      EMPTY_STORE,
      [{ id: "piece-badge-eligible", piece: "bishop" }],
      NOW,
    );
    expect(next.events["piece-badge-eligible:bishop"]?.piece).toBe("bishop");
  });

  it("is idempotent — re-deriving a recorded event returns the same reference", () => {
    const first = computeRecordEarned(EMPTY_STORE, [{ id: "first-reward" }], NOW);
    const second = computeRecordEarned(first, [{ id: "first-reward" }], NOW);
    expect(second).toBe(first);
  });

  it("never overwrites earnedAt on a re-derive", () => {
    const first = computeRecordEarned(EMPTY_STORE, [{ id: "first-reward" }], NOW);
    const later = computeRecordEarned(
      first,
      [{ id: "first-reward" }],
      "2026-07-12T10:00:00.000Z",
    );
    expect(later.events["first-reward"].earnedAt).toBe(NOW);
  });
});

describe("selectPending", () => {
  it("returns events that have never been celebrated", () => {
    const store = computeRecordEarned(EMPTY_STORE, [{ id: "first-reward" }], NOW);
    expect(selectPending(store)).toEqual([{ id: "first-reward", piece: undefined }]);
  });

  it("excludes an already celebrated event", () => {
    const earned = computeRecordEarned(EMPTY_STORE, [{ id: "first-reward" }], NOW);
    const celebrated = computeMarkCelebrated(earned, "first-reward", undefined, NOW);
    expect(selectPending(celebrated)).toEqual([]);
  });
});

describe("computeMarkCelebrated", () => {
  it("returns the SAME reference for an event that was never recorded", () => {
    expect(computeMarkCelebrated(EMPTY_STORE, "first-reward", undefined, NOW)).toBe(
      EMPTY_STORE,
    );
  });
});

describe("computeMarkOpened", () => {
  it("clears the NEW dot on a navigable milestone", () => {
    const earned = computeRecordEarned(EMPTY_STORE, [{ id: "special-training" }], NOW);
    const opened = computeMarkOpened(earned, "special-training", undefined, NOW);
    expect(opened.events["special-training"].openedAt).toBe(NOW);
  });

  it("refuses to write openedAt on a recognition — it has no destination", () => {
    const earned = computeRecordEarned(
      EMPTY_STORE,
      [{ id: "great-focus-session" }],
      NOW,
    );
    const opened = computeMarkOpened(earned, "great-focus-session", undefined, NOW);
    expect(opened.events["great-focus-session"].openedAt).toBeUndefined();
    expect(opened).toBe(earned);
  });

  it("returns the SAME reference for an unrecorded navigable milestone", () => {
    expect(computeMarkOpened(EMPTY_STORE, "special-training", undefined, NOW)).toBe(
      EMPTY_STORE,
    );
  });

  it("refuses to write openedAt on piece-badge-claimed — a recognition, not a destination", () => {
    const earned = computeRecordEarned(
      EMPTY_STORE,
      [{ id: "piece-badge-claimed", piece: "rook" }],
      NOW,
    );
    const opened = computeMarkOpened(earned, "piece-badge-claimed", "rook", NOW);
    expect(opened.events["piece-badge-claimed:rook"].openedAt).toBeUndefined();
    expect(opened).toBe(earned);
  });

  it("refuses to write openedAt on mastery — a recognition, not a destination", () => {
    const earned = computeRecordEarned(
      EMPTY_STORE,
      [{ id: "mastery", piece: "rook" }],
      NOW,
    );
    const opened = computeMarkOpened(earned, "mastery", "rook", NOW);
    expect(opened.events["mastery:rook"].openedAt).toBeUndefined();
    expect(opened).toBe(earned);
  });
});
