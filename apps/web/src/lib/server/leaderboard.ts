import { fetchLeaderboardFromDb, type LeaderboardRow as DbRow } from "@/lib/supabase/queries";

export type LeaderboardRow = {
  rank: number;
  player: string;
  score: number;
  isVerified?: boolean;
};

export async function fetchLeaderboard(): Promise<LeaderboardRow[]> {
  const rows = await fetchLeaderboardFromDb();

  return rows.map((r) => ({
    rank: r.rank,
    player: r.player.slice(0, 6) + "..." + r.player.slice(-4),
    score: r.total_score,
    isVerified: r.is_verified,
  }));
}
