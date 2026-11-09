import type { VictoryEntry } from "@/lib/game/victory-events";
import { ACHIEVEMENT_DEFS } from "./definitions";

export type Achievement = {
  id: string;
  earned: boolean;
  progress?: { current: number; goal: number };
};

export type AchievementsSummary = {
  list: Achievement[];
  earnedCount: number;
  total: number;
};

/**
 * Computes every achievement's state from a player's Victory NFT list.
 * Pure, synchronous, side-effect free — safe to run on every render.
 */
export function computeAchievements(victories: readonly VictoryEntry[] | undefined): AchievementsSummary {
  const vs = victories ?? [];
  const list: Achievement[] = ACHIEVEMENT_DEFS.map((def) => {
    const result = def.check(vs as VictoryEntry[]);
    return {
      id: def.id,
      earned: result.earned,
      progress: result.progress,
    };
  });
  const earnedCount = list.filter((a) => a.earned).length;
  return {
    list,
    earnedCount,
    total: ACHIEVEMENT_DEFS.length,
  };
}
