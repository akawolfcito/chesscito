import { TIER_LABELS, TIER_THRESHOLDS } from "@/lib/content/editorial";

export type TierKey = keyof typeof TIER_LABELS;

export type TierStats = {
  address: `0x${string}` | undefined;
  puzzlesSolved: number;
  piecesMastered: number;
  arenaWins: number;
  daysStreak: number;
};

/**
 * Returns the tier key + computed XP. The tier *title* is no longer
 * baked in — callers resolve it themselves via
 * `t(\`tierLabels.${result.tier}\`)` so the label localizes per
 * request without forking this helper.
 */
export type TierResult = {
  tier: TierKey;
  xp: number;
};

const safe = (n: number): number => (Number.isFinite(n) && n > 0 ? n : 0);

export function computeTier(stats: TierStats): TierResult {
  if (!stats.address) {
    return { tier: "visitor", xp: 0 };
  }

  const xp =
    safe(stats.puzzlesSolved) * 10 +
    safe(stats.piecesMastered) * 25 +
    safe(stats.arenaWins) * 15 +
    safe(stats.daysStreak) * 5;

  const puzzles = safe(stats.puzzlesSolved);

  let tier: TierKey = "apprentice";
  if (puzzles >= TIER_THRESHOLDS.grandmaster) tier = "grandmaster";
  else if (puzzles >= TIER_THRESHOLDS.wizard) tier = "wizard";
  else if (puzzles >= TIER_THRESHOLDS.knight) tier = "knight";
  else if (puzzles >= TIER_THRESHOLDS.trainee) tier = "trainee";

  return { tier, xp };
}
