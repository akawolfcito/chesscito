import type { GameRecord, BadgeCriteria } from "./types";

const DIFFICULTY_ORDER: Record<string, number> = { easy: 0, medium: 1, hard: 2 };

const BADGE_DEFINITIONS: BadgeCriteria[] = [
  { area: "tactics", metric: "win_rate_hard", threshold: 0.4, windowSize: 10, minDifficulty: "hard" },
  { area: "efficiency", metric: "avg_moves_to_win", threshold: 25, windowSize: 10, minDifficulty: "medium" },
  { area: "consistency", metric: "win_streak", threshold: 5, windowSize: 20, minDiverseDifficulties: 2 },
  { area: "endgame", metric: "win_rate_long_games", threshold: 0.5, windowSize: 10, minDifficulty: "medium" },
];

export type BadgeResult = {
  area: string;
  earned: boolean;
  progress: number;
  threshold: number;
};

export function evaluateBadges(games: GameRecord[]): BadgeResult[] {
  return BADGE_DEFINITIONS.map((badge) => {
    const window = games.slice(-badge.windowSize);

    const filtered = badge.minDifficulty
      ? window.filter((g) => DIFFICULTY_ORDER[g.difficulty] >= DIFFICULTY_ORDER[badge.minDifficulty!])
      : window;

    if (badge.minDiverseDifficulties) {
      const uniqueDiffs = new Set(window.map((g) => g.difficulty));
      if (uniqueDiffs.size < badge.minDiverseDifficulties) {
        return { area: badge.area, earned: false, progress: 0, threshold: badge.threshold };
      }
    }

    const progress = computeMetric(badge.metric, filtered);

    return {
      area: badge.area,
      earned: filtered.length >= Math.min(badge.windowSize, 5) && meetsThreshold(badge.metric, progress, badge.threshold),
      progress,
      threshold: badge.threshold,
    };
  });
}

function meetsThreshold(metric: string, value: number, threshold: number): boolean {
  if (metric === "avg_moves_to_win") return value > 0 && value <= threshold;
  return value >= threshold;
}

function computeMetric(metric: string, games: GameRecord[]): number {
  if (games.length === 0) return 0;

  switch (metric) {
    case "win_rate_hard":
    case "win_rate_long_games": {
      const relevant = metric === "win_rate_long_games"
        ? games.filter((g) => g.totalMoves > 30)
        : games;
      if (relevant.length === 0) return 0;
      return relevant.filter((g) => g.result === "win").length / relevant.length;
    }
    case "avg_moves_to_win": {
      const wins = games.filter((g) => g.result === "win");
      if (wins.length === 0) return 0;
      return wins.reduce((sum, g) => sum + g.totalMoves, 0) / wins.length;
    }
    case "win_streak": {
      let streak = 0;
      for (let i = games.length - 1; i >= 0; i--) {
        if (games[i].result === "win") streak++;
        else break;
      }
      return streak;
    }
    default:
      return 0;
  }
}
