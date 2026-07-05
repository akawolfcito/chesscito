import { beforeEach, describe, expect, it } from "vitest";
import {
  getPlayTacticsProgress,
  isPlayTacticsCompletedToday,
  PLAY_TACTICS_STORAGE_KEY,
  recordPlayTacticsCompletion,
} from "../progress";

describe("Play Tactics progress", () => {
  beforeEach(() => localStorage.clear());

  it("uses an isolated v1 key with no streak field", () => {
    const next = recordPlayTacticsCompletion("2026-07-05");

    expect(next).toEqual({
      lastCompletedDate: "2026-07-05",
      totalCompleted: 1,
    });
    expect(next).not.toHaveProperty("streak");
    expect(JSON.parse(localStorage.getItem(PLAY_TACTICS_STORAGE_KEY)!)).toEqual(next);
    expect([...Array(localStorage.length)].map((_, index) => localStorage.key(index))).toEqual([
      PLAY_TACTICS_STORAGE_KEY,
    ]);
  });

  it("deduplicates completion on the same UTC day", () => {
    recordPlayTacticsCompletion("2026-07-05");
    const repeated = recordPlayTacticsCompletion("2026-07-05");
    expect(repeated.totalCompleted).toBe(1);
  });

  it("increments lifetime completion on a later UTC day", () => {
    recordPlayTacticsCompletion("2026-07-05");
    const next = recordPlayTacticsCompletion("2026-07-06");
    expect(next.totalCompleted).toBe(2);
    expect(isPlayTacticsCompletedToday("2026-07-06", next)).toBe(true);
  });

  it("fails closed to empty progress for corrupt storage", () => {
    localStorage.setItem(PLAY_TACTICS_STORAGE_KEY, "not-json");
    expect(getPlayTacticsProgress()).toEqual({
      lastCompletedDate: null,
      totalCompleted: 0,
    });
  });
});
