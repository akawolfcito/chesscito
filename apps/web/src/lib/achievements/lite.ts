import type { DailyProgress } from "@/lib/daily/progress";
import type { Achievement } from "./compute";

/**
 * Derives the 4 Lite achievements from DailyProgress.
 * Pure, synchronous, side-effect free — safe to run on every render.
 * Only Daily Focus counts (no Exercises, no Labyrinths).
 *
 * `first-focus-day` measures CONTINUITY (did you show up today?).
 * `first-great-session` measures DEPTH (was the session substantial?) — a
 * separate badge, not a rename, so a player who already earned
 * first-focus-day never has it silently revoked by a re-derivation from a
 * counter they don't have.
 */
export function deriveLiteAchievements(
  progress: DailyProgress,
  hadGreatSession: boolean,
): Achievement[] {
  const { streak, totalCompleted } = progress;
  const firstDone = totalCompleted >= 1;
  const rhythmDone = streak >= 3;
  const weekDone = streak >= 7;
  return [
    {
      id: "first-focus-day",
      earned: firstDone,
      progress: firstDone ? undefined : { current: Math.min(totalCompleted, 1), goal: 1 },
    },
    {
      id: "first-great-session",
      earned: hadGreatSession,
      progress: hadGreatSession ? undefined : { current: 0, goal: 1 },
    },
    {
      id: "three-day-rhythm",
      earned: rhythmDone,
      progress: rhythmDone ? undefined : { current: Math.min(streak, 3), goal: 3 },
    },
    {
      id: "seven-day-focus",
      earned: weekDone,
      progress: weekDone ? undefined : { current: Math.min(streak, 7), goal: 7 },
    },
  ];
}
