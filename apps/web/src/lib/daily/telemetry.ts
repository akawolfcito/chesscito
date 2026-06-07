/**
 * Daily Tactic telemetry — Sprint 2 commit D of Training Economy Alpha
 * (2026-06-06). Three events fired through the existing `track()`
 * stack (no parallel emitter). Sprint 2 reserves the `peonesEarned`
 * and `bonusPeonesEarned` fields and pins them to 0; Sprint 3 wires
 * the real ledger and updates the emitters in-place.
 *
 * Telemetry is fire-and-forget per the existing `track()` contract —
 * any failure inside the network call is swallowed so an analytics
 * outage cannot break the Daily Tactic flow.
 */

import { track } from "@/lib/telemetry";
import { getPuzzleDifficulty, type DailyTacticData } from "./daily-puzzles";
import type { DailyProgress } from "./progress";

export type StreakType = "first" | "extended" | "reset";

/**
 * Classifies the transition between two DailyProgress snapshots into
 * one of the three streak-event categories, or returns `null` when
 * nothing actually changed (e.g., replay of an already-completed day).
 *
 * Rules:
 *  - "first": the user's lifetime totalCompleted was 0 before this
 *             completion. Distinguishes a first-ever solve from a
 *             post-break restart.
 *  - "extended": the streak grew (prev.streak < next.streak), meaning
 *                yesterday's completion is still active.
 *  - "reset": any other state change — skip days followed by recovery,
 *             or a user with a broken streak rebuilding it.
 *  - `null`: identical snapshots (recordDailyCompletion no-op branch).
 */
export function classifyStreakChange(
  prev: DailyProgress,
  next: DailyProgress,
): StreakType | null {
  if (
    next.lastCompletedDate === prev.lastCompletedDate &&
    next.streak === prev.streak &&
    next.totalCompleted === prev.totalCompleted
  ) {
    return null;
  }
  if (prev.totalCompleted === 0) return "first";
  // "extended" requires next.streak >= 2 — recordDailyCompletion only
  // grows the streak (to N+1 ≥ 2) when prev.lastCompletedDate was
  // yesterday. Going from 0 → 1 in any other shape means the previous
  // streak was lost and the user is rebuilding (reset), even though
  // the count went up.
  if (next.streak >= 2) return "extended";
  return "reset";
}

export function emitDailyTacticStarted(args: {
  puzzle: DailyTacticData;
  puzzleDate: string;
  currentStreak: number;
  isPro: boolean;
}): void {
  track("daily_tactic_started", {
    puzzleId: args.puzzle.id,
    puzzleDate: args.puzzleDate,
    difficulty: getPuzzleDifficulty(args.puzzle),
    pieceShown: args.puzzle.piece,
    currentStreak: args.currentStreak,
    isPro: args.isPro,
  });
}

export function emitDailyTacticCompleted(args: {
  puzzle: DailyTacticData;
  puzzleDate: string;
  movesUsed: number;
  starsEarned: number;
  newStreak: number;
  isPro: boolean;
}): void {
  track("daily_tactic_completed", {
    puzzleId: args.puzzle.id,
    puzzleDate: args.puzzleDate,
    difficulty: getPuzzleDifficulty(args.puzzle),
    pieceShown: args.puzzle.piece,
    movesUsed: args.movesUsed,
    optimalMoves: args.puzzle.exercise.optimalMoves,
    starsEarned: args.starsEarned,
    newStreak: args.newStreak,
    // Sprint 2 stub: the ledger lands in Sprint 3 (commit E preview
    // → commit F real economy). Field reserved in the event schema
    // so downstream consumers can build dashboards now and the
    // numbers become non-zero without a schema migration.
    peonesEarned: 0,
    isPro: args.isPro,
  });
}

export function emitDailyStreakUpdated(args: {
  newStreak: number;
  streakType: StreakType;
}): void {
  track("daily_streak_updated", {
    newStreak: args.newStreak,
    streakType: args.streakType,
    bonusPeonesEarned: 0, // Sprint 2 stub — see emitDailyTacticCompleted.
  });
}
