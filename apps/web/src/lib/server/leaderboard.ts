import {
  fetchLeaderboardFromDb,
  fetchPlayerRankFromDb,
  type LeaderboardRow as DbRow,
} from "@/lib/supabase/queries";

export type LeaderboardRow = {
  rank: number;
  player: string;
  score: number;
  isVerified?: boolean;
  /** Player has at least one on-chain score (Scoreboard contract). */
  hasOnchain?: boolean;
};

function toApiRow(r: DbRow): LeaderboardRow {
  return {
    rank: r.rank,
    player: r.player.slice(0, 6) + "..." + r.player.slice(-4),
    score: r.total_score,
    isVerified: r.is_verified,
    hasOnchain: r.has_onchain ?? false,
  };
}

export async function fetchLeaderboard(): Promise<LeaderboardRow[]> {
  const rows = await fetchLeaderboardFromDb();
  return rows.map(toApiRow);
}

/** The caller's own row with its real rank over the FULL ranking —
 *  visible even outside the top-10 cut (QA G4 2026-06-11). */
export async function fetchPlayerRank(
  player: string,
): Promise<LeaderboardRow | null> {
  const row = await fetchPlayerRankFromDb(player);
  return row ? toApiRow(row) : null;
}
