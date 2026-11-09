import {
  fetchHallOfFame as fetchHofFromDb,
  fetchPlayerVictories as fetchPlayerFromDb,
  type VictoryRow as DbVictoryRow,
} from "@/lib/supabase/queries";

export type VictoryRow = {
  tokenId: string;
  player: string;
  difficulty: number;
  totalMoves: number;
  timeMs: number;
  timestamp: number;
};

function toApiRow(row: DbVictoryRow): VictoryRow {
  return {
    tokenId: String(row.token_id),
    player: row.player,
    difficulty: row.difficulty,
    totalMoves: row.total_moves,
    timeMs: row.time_ms,
    timestamp: Math.floor(new Date(row.minted_at).getTime() / 1000),
  };
}

export async function getHallOfFame(): Promise<VictoryRow[]> {
  const rows = await fetchHofFromDb();
  return rows.map(toApiRow);
}

export async function getPlayerVictories(player: string): Promise<VictoryRow[]> {
  const rows = await fetchPlayerFromDb(player);
  return rows.map(toApiRow);
}
