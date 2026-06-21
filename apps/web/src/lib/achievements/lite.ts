import type { DailyProgress } from "@/lib/daily/progress";
import type { Achievement } from "./compute";

/**
 * Derives the 3 Lite achievements from DailyProgress.
 * Pure, synchronous, side-effect free — safe to run on every render.
 * Only Daily Focus counts (no Exercises, no Labyrinths).
 */
export function deriveLiteAchievements(progress: DailyProgress): Achievement[] {
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
