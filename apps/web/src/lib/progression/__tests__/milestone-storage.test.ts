import { describe, expect, it } from "vitest";
import {
  computeMarkCelebrated,
  computeMarkOpened,
  computeRecordEarned,
  parseMilestoneStore,
  selectPending,
} from "@/lib/progression/milestone-storage";
import { EMPTY_STORE, type MilestoneStore } from "@/lib/progression/types";

const NOW = "2026-07-11T10:00:00.000Z";
const TODAY = "2026-07-11";

describe("parseMilestoneStore", () => {
  it("returns an empty store for corrupt input", () => {
    expect(parseMilestoneStore("{{{", TODAY)).toEqual(EMPTY_STORE);
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
});
