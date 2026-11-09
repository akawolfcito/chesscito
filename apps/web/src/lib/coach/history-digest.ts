import type { CoachAnalysisRow, HistoryDigest, WeaknessTag } from "./types";
import { getSupabaseServer } from "../supabase/server";

const HISTORY_DIGEST_DEPTH = 20;

/**
 * Pure aggregator over the rows returned by `aggregateHistory` — no I/O.
 *
 * - Returns `null` when `rows.length === 0` (signals "no augmentation block" in §6.3).
 * - `gamesPlayed = rows.length` (caller caps at 20 via `LIMIT 20`).
 * - `topWeaknessTags`: top 3 tags by count DESC; ties broken alphabetically ASC.
 *
 * Spec §5 / §6.3.
 */
export function aggregateRows(rows: CoachAnalysisRow[]): HistoryDigest | null {
  if (rows.length === 0) return null;

  const recentResults = { win: 0, lose: 0, draw: 0, resigned: 0 };
  const tagCounts = new Map<WeaknessTag, number>();

  for (const row of rows) {
    recentResults[row.result] += 1;
    for (const tag of row.weakness_tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  const topWeaknessTags = Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.tag.localeCompare(b.tag);
    })
    .slice(0, 3);

  return {
    gamesPlayed: rows.length,
    recentResults,
    topWeaknessTags,
  };
}

/**
 * Read the last 20 analyses for `wallet` and aggregate them into a digest.
 *
 * Fail-soft semantics (§6.5):
 * - Missing env (`getSupabaseServer()` returns null) → null.
 * - SELECT error → null.
 * - Empty result set → null (via `aggregateRows`).
 *
 * Caller (PR 3 `analyze` route) treats `null` as "no augmentation block".
 */
export async function aggregateHistory(wallet: string): Promise<HistoryDigest | null> {
  const supabase = getSupabaseServer();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("coach_analyses")
    .select(
      "wallet, game_id, created_at, expires_at, kind, difficulty, result, total_moves, summary_text, mistakes, lessons, praise, weakness_tags",
    )
    .eq("wallet", wallet)
    .order("created_at", { ascending: false })
    .limit(HISTORY_DIGEST_DEPTH);

  if (error || !data) return null;

  return aggregateRows(data as CoachAnalysisRow[]);
}
