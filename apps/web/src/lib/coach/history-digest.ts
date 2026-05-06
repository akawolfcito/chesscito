import type { CoachAnalysisRow, HistoryDigest, WeaknessTag } from "./types.js";

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
