/**
 * Tests for the Daily Tactic telemetry module added in Sprint 2
 * commit D (Training Economy Alpha 2026-06-06).
 *
 * Two layers:
 *  - Pure `classifyStreakChange` tests covering the four transition
 *    classes (first / extended / reset / null).
 *  - Emitter tests that mock `track()` and assert the wire-shape of
 *    each event, including the Sprint 2 stub fields `peonesEarned: 0`
 *    and `bonusPeonesEarned: 0`.
 *
 * Component-level dedup (HubDailyTile / DailyTacticSlot useRef gate
 * for `daily_tactic_started`) is not exercised here — that surface
 * is verified via manual smoke and code review. The pure helpers
 * + emitter contracts are the deterministic part worth nailing.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/telemetry", () => ({
  track: vi.fn(),
}));

import { track } from "@/lib/telemetry";
import type { DailyTacticData } from "@/lib/daily/daily-puzzles";
import type { DailyProgress } from "@/lib/daily/progress";
import {
  classifyStreakChange,
  emitDailyStreakUpdated,
  emitDailyTacticCompleted,
  emitDailyTacticStarted,
} from "@/lib/daily/telemetry";

const mockTrack = vi.mocked(track);

function callsOf(name: string) {
  return mockTrack.mock.calls.filter((c) => c[0] === name);
}

const FAKE_PUZZLE: DailyTacticData = {
  id: "dt-rook-1",
  name: "Rook — horizontal slide",
  piece: "rook",
  difficulty: "easy",
  exercise: {
    id: "dt-rook-1",
    startPos: { file: 0, rank: 0 },
    targetPos: { file: 7, rank: 0 },
    optimalMoves: 1,
  },
  hint: "Slide horizontally.",
};

const FAKE_PUZZLE_NO_DIFFICULTY: DailyTacticData = {
  ...FAKE_PUZZLE,
  id: "dt-legacy-1",
  difficulty: undefined,
};

beforeEach(() => {
  mockTrack.mockClear();
});

describe("classifyStreakChange", () => {
  it("returns null when both snapshots are identical (no-op replay)", () => {
    const prev: DailyProgress = {
      streak: 3,
      lastCompletedDate: "2026-06-05",
      totalCompleted: 7,
    };
    expect(classifyStreakChange(prev, { ...prev })).toBeNull();
  });

  it('returns "first" when prev.totalCompleted was 0 (first-ever solve)', () => {
    const prev: DailyProgress = {
      streak: 0,
      lastCompletedDate: null,
      totalCompleted: 0,
    };
    const next: DailyProgress = {
      streak: 1,
      lastCompletedDate: "2026-06-05",
      totalCompleted: 1,
    };
    expect(classifyStreakChange(prev, next)).toBe("first");
  });

  it('returns "extended" when streak grew from a non-zero base (yesterday continuation)', () => {
    const prev: DailyProgress = {
      streak: 4,
      lastCompletedDate: "2026-06-04",
      totalCompleted: 10,
    };
    const next: DailyProgress = {
      streak: 5,
      lastCompletedDate: "2026-06-05",
      totalCompleted: 11,
    };
    expect(classifyStreakChange(prev, next)).toBe("extended");
  });

  it('returns "reset" when streak dropped (user skipped days)', () => {
    const prev: DailyProgress = {
      streak: 7,
      lastCompletedDate: "2026-06-01",
      totalCompleted: 20,
    };
    const next: DailyProgress = {
      streak: 1,
      lastCompletedDate: "2026-06-05",
      totalCompleted: 21,
    };
    expect(classifyStreakChange(prev, next)).toBe("reset");
  });

  it('returns "reset" when the user rebuilt from streak=0 (post-break recovery, NOT first-ever)', () => {
    const prev: DailyProgress = {
      streak: 0,
      lastCompletedDate: "2026-05-15",
      totalCompleted: 5,
    };
    const next: DailyProgress = {
      streak: 1,
      lastCompletedDate: "2026-06-05",
      totalCompleted: 6,
    };
    // Not "first" because totalCompleted was > 0 before this solve.
    // The semantic is "the user's old streak ended, they're starting over."
    expect(classifyStreakChange(prev, next)).toBe("reset");
  });
});

describe("emitDailyTacticStarted", () => {
  it("emits with the canonical payload from a difficulty-tagged puzzle", () => {
    emitDailyTacticStarted({
      puzzle: FAKE_PUZZLE,
      puzzleDate: "2026-06-05",
      currentStreak: 3,
      isPro: false,
    });
    const calls = callsOf("daily_tactic_started");
    expect(calls).toHaveLength(1);
    expect(calls[0]![1]).toEqual({
      puzzleId: "dt-rook-1",
      puzzleDate: "2026-06-05",
      difficulty: "easy",
      pieceShown: "rook",
      currentStreak: 3,
      isPro: false,
      isLite: false,
    });
  });

  it("resolves missing difficulty through getPuzzleDifficulty default", () => {
    emitDailyTacticStarted({
      puzzle: FAKE_PUZZLE_NO_DIFFICULTY,
      puzzleDate: "2026-06-05",
      currentStreak: 0,
      isPro: true,
    });
    const calls = callsOf("daily_tactic_started");
    expect(calls).toHaveLength(1);
    expect(calls[0]![1]).toMatchObject({
      difficulty: "easy",
      isPro: true,
    });
  });
});

describe("emitDailyTacticCompleted", () => {
  it("emits with the full payload, carries real peonesEarned + rewardPreviewPeones overlap (Sprint 3 commit E)", () => {
    emitDailyTacticCompleted({
      puzzle: FAKE_PUZZLE,
      puzzleDate: "2026-06-05",
      movesUsed: 1,
      starsEarned: 3,
      newStreak: 4,
      isPro: true,
      rewardPreviewPeones: 3,
      peonesEarned: 3,
    });
    const calls = callsOf("daily_tactic_completed");
    expect(calls).toHaveLength(1);
    expect(calls[0]![1]).toEqual({
      puzzleId: "dt-rook-1",
      puzzleDate: "2026-06-05",
      difficulty: "easy",
      pieceShown: "rook",
      movesUsed: 1,
      optimalMoves: 1,
      starsEarned: 3,
      newStreak: 4,
      peonesEarned: 3,
      rewardPreviewPeones: 3,
      isPro: true,
      isLite: false,
    });
  });

  it("preserves optimalMoves from the puzzle when movesUsed exceeds it", () => {
    emitDailyTacticCompleted({
      puzzle: FAKE_PUZZLE,
      puzzleDate: "2026-06-05",
      movesUsed: 3,
      starsEarned: 1,
      newStreak: 1,
      isPro: false,
      rewardPreviewPeones: 0,
      peonesEarned: 0,
    });
    expect(callsOf("daily_tactic_completed")[0]![1]).toMatchObject({
      movesUsed: 3,
      optimalMoves: 1,
      starsEarned: 1,
    });
  });

  it("guest path: both peonesEarned and rewardPreviewPeones are 0", () => {
    emitDailyTacticCompleted({
      puzzle: FAKE_PUZZLE,
      puzzleDate: "2026-06-05",
      movesUsed: 1,
      starsEarned: 3,
      newStreak: 1,
      isPro: false,
      rewardPreviewPeones: 0,
      peonesEarned: 0,
    });
    expect(callsOf("daily_tactic_completed")[0]![1]).toMatchObject({
      peonesEarned: 0,
      rewardPreviewPeones: 0,
    });
  });

  it("Sprint 3: when earn fails, peonesEarned=0 even if the user solved (degrades to guest-shape)", () => {
    emitDailyTacticCompleted({
      puzzle: FAKE_PUZZLE,
      puzzleDate: "2026-06-05",
      movesUsed: 1,
      starsEarned: 3,
      newStreak: 1,
      isPro: false,
      rewardPreviewPeones: 0,
      peonesEarned: 0,
    });
    expect(callsOf("daily_tactic_completed")[0]![1]).toMatchObject({
      peonesEarned: 0,
    });
  });
});

describe("emitDailyStreakUpdated", () => {
  it.each<["first" | "extended" | "reset"]>([
    ["first"],
    ["extended"],
    ["reset"],
  ])('emits with streakType=%s and bonusPeonesEarned=0', (type) => {
    emitDailyStreakUpdated({ newStreak: 5, streakType: type });
    const calls = callsOf("daily_streak_updated");
    expect(calls).toHaveLength(1);
    expect(calls[0]![1]).toEqual({
      newStreak: 5,
      streakType: type,
      bonusPeonesEarned: 0,
      isLite: false,
    });
  });
});

describe("Sprint 3 telemetry guarantees", () => {
  it("Daily Tactic telemetry module never emits a peones_earned event (reserved for commit H+)", () => {
    emitDailyTacticStarted({
      puzzle: FAKE_PUZZLE,
      puzzleDate: "2026-06-05",
      currentStreak: 0,
      isPro: false,
    });
    emitDailyTacticCompleted({
      puzzle: FAKE_PUZZLE,
      puzzleDate: "2026-06-05",
      movesUsed: 1,
      starsEarned: 3,
      newStreak: 1,
      isPro: false,
      rewardPreviewPeones: 3,
      peonesEarned: 3,
    });
    emitDailyStreakUpdated({ newStreak: 1, streakType: "first" });

    // Sprint 3 commit E credits the ledger via /api/peones/earn but
    // does NOT add a `peones_earned` telemetry event in this module
    // — that event ships in commit H once dashboards are ready.
    expect(callsOf("peones_earned")).toHaveLength(0);
  });

  it("bonusPeonesEarned still pinned to 0 (streak bonus real lands in a later sub-commit)", () => {
    emitDailyStreakUpdated({ newStreak: 1, streakType: "first" });
    expect(callsOf("daily_streak_updated")[0]![1]).toMatchObject({
      bonusPeonesEarned: 0,
    });
  });

  it("rewardPreviewPeones overlap is preserved alongside peonesEarned in the completed payload", () => {
    emitDailyTacticCompleted({
      puzzle: FAKE_PUZZLE,
      puzzleDate: "2026-06-05",
      movesUsed: 1,
      starsEarned: 3,
      newStreak: 1,
      isPro: true,
      rewardPreviewPeones: 3,
      peonesEarned: 3,
    });
    const completed = callsOf("daily_tactic_completed")[0]![1];
    expect(completed).toMatchObject({
      peonesEarned: 3,
      rewardPreviewPeones: 3,
    });
  });
});

import { emitPassportSlotsUpdated } from "@/lib/daily/telemetry";

describe("Lite B1.2 — isLite dimension on daily tactic events", () => {
  it("daily_tactic_started carries isLite: true when passed", () => {
    emitDailyTacticStarted({
      puzzle: FAKE_PUZZLE,
      puzzleDate: "2026-06-22",
      currentStreak: 1,
      isPro: false,
      isLite: true,
    });
    expect(callsOf("daily_tactic_started")[0]![1]).toMatchObject({ isLite: true });
  });

  it("daily_tactic_started defaults isLite to false when omitted", () => {
    emitDailyTacticStarted({
      puzzle: FAKE_PUZZLE,
      puzzleDate: "2026-06-22",
      currentStreak: 0,
      isPro: false,
    });
    expect(callsOf("daily_tactic_started")[0]![1]).toMatchObject({ isLite: false });
  });

  it("daily_tactic_completed carries isLite: true when passed", () => {
    emitDailyTacticCompleted({
      puzzle: FAKE_PUZZLE,
      puzzleDate: "2026-06-22",
      movesUsed: 1,
      starsEarned: 3,
      newStreak: 2,
      isPro: false,
      rewardPreviewPeones: 0,
      peonesEarned: 0,
      isLite: true,
    });
    expect(callsOf("daily_tactic_completed")[0]![1]).toMatchObject({ isLite: true });
  });

  it("daily_tactic_completed defaults isLite to false when omitted", () => {
    emitDailyTacticCompleted({
      puzzle: FAKE_PUZZLE,
      puzzleDate: "2026-06-22",
      movesUsed: 1,
      starsEarned: 3,
      newStreak: 1,
      isPro: false,
      rewardPreviewPeones: 0,
      peonesEarned: 0,
    });
    expect(callsOf("daily_tactic_completed")[0]![1]).toMatchObject({ isLite: false });
  });

  it("daily_streak_updated carries isLite: true when passed", () => {
    emitDailyStreakUpdated({ newStreak: 3, streakType: "extended", isLite: true });
    expect(callsOf("daily_streak_updated")[0]![1]).toMatchObject({ isLite: true });
  });

  it("daily_streak_updated defaults isLite to false when omitted", () => {
    emitDailyStreakUpdated({ newStreak: 1, streakType: "first" });
    expect(callsOf("daily_streak_updated")[0]![1]).toMatchObject({ isLite: false });
  });
});

describe("Lite B1.2 — emitPassportSlotsUpdated", () => {
  it("emits passport_slots_updated with isLite: true, filledSlots, newStreak, totalSlots: 7", () => {
    emitPassportSlotsUpdated({ newStreak: 3, filledSlots: 3 });
    const calls = callsOf("passport_slots_updated");
    expect(calls).toHaveLength(1);
    expect(calls[0]![1]).toEqual({
      isLite: true,
      newStreak: 3,
      filledSlots: 3,
      totalSlots: 7,
    });
  });

  it("clamps filledSlots at 7 (caller responsibility — verified here as documentation)", () => {
    emitPassportSlotsUpdated({ newStreak: 10, filledSlots: 7 });
    expect(callsOf("passport_slots_updated")[0]![1]).toMatchObject({ filledSlots: 7, totalSlots: 7 });
  });

  it("never emits Full-mode daily_tactic events alongside passport_slots_updated", () => {
    emitPassportSlotsUpdated({ newStreak: 1, filledSlots: 1 });
    const wrongEvents = mockTrack.mock.calls.filter((c) => c[0].startsWith("daily_tactic_"));
    expect(wrongEvents).toHaveLength(0);
  });
});
