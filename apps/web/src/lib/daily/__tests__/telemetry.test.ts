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
  it("emits with the full payload and pins peonesEarned=0 (Sprint 2 stub)", () => {
    emitDailyTacticCompleted({
      puzzle: FAKE_PUZZLE,
      puzzleDate: "2026-06-05",
      movesUsed: 1,
      starsEarned: 3,
      newStreak: 4,
      isPro: true,
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
      peonesEarned: 0,
      isPro: true,
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
    });
    expect(callsOf("daily_tactic_completed")[0]![1]).toMatchObject({
      movesUsed: 3,
      optimalMoves: 1,
      starsEarned: 1,
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
    });
  });
});

describe("Sprint 2 stub guarantees (no real Peones until Sprint 3)", () => {
  it("never emits a peones_earned event from any Daily Tactic emitter", () => {
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
    });
    emitDailyStreakUpdated({ newStreak: 1, streakType: "first" });

    // peones_earned belongs to Sprint 3+ — must NOT appear in this
    // commit's event surface.
    expect(callsOf("peones_earned")).toHaveLength(0);
  });

  it("peonesEarned and bonusPeonesEarned are both 0 in the Sprint 2 payload", () => {
    emitDailyTacticCompleted({
      puzzle: FAKE_PUZZLE,
      puzzleDate: "2026-06-05",
      movesUsed: 1,
      starsEarned: 3,
      newStreak: 1,
      isPro: true,
    });
    emitDailyStreakUpdated({ newStreak: 1, streakType: "first" });

    expect(callsOf("daily_tactic_completed")[0]![1]).toMatchObject({
      peonesEarned: 0,
    });
    expect(callsOf("daily_streak_updated")[0]![1]).toMatchObject({
      bonusPeonesEarned: 0,
    });
  });
});
