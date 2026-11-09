import type { ExerciseTier } from "@/lib/game/types";

/**
 * How the builder's record list presents itself.
 *
 * Lives here rather than inline in the page for the reason every other piece of
 * this builder moved out: a rule inside a 1200-line component is a rule nobody
 * can test, and the ones that went untested in here are exactly the ones that
 * silently rewrote content.
 */

/** The slice of a record the list actually reads. Deliberately structural and
 *  not `LabyrinthRecord`, so these helpers can be exercised on four-key objects
 *  instead of dragging a full FEN-bearing fixture into every case. */
export type LibraryRecord = {
  id?: string;
  order: number;
  tier?: ExerciseTier;
  explanation?: string;
};

/**
 * What a row is CALLED.
 *
 * The list used to show `rook-9`, which says where a board sits in a file and
 * nothing about what it is. The author picks a board by what it teaches —
 * "Friendly blocker" — so the description leads and the id becomes the
 * secondary, technical label beside it.
 *
 * ⚠️ The description is optional and plenty of records have none, so the id is
 * a real fallback, not a defensive one. A whitespace-only description counts as
 * absent: it would otherwise render a row with no visible name at all.
 */
export function recordDisplayName(rec: LibraryRecord): string {
  const named = rec.explanation?.trim();
  if (named) return named;
  return rec.id?.trim() || "(no id)";
}

const TIER_ORDER: Record<ExerciseTier, number> = {
  easy: 0,
  medium: 1,
  hard: 2,
};

/**
 * Difficulty as a sortable number.
 *
 * ⚠️ An ABSENT tier ranks as `medium`, because that is what the catalog defaults
 * it to downstream (`toPuzzleInput`: `tier: s.tier ?? "medium"`). Sorting the
 * untiered records to either end would file them under a difficulty they do not
 * actually have in game.
 */
export function tierRank(tier: ExerciseTier | undefined): number {
  return TIER_ORDER[tier ?? "medium"];
}

/** `order` = the sequence the player meets these boards in. `tier` = grouped by
 *  difficulty, sequence preserved inside each band. */
export type LibrarySort = "order" | "tier";

/**
 * Sort a copy of the list.
 *
 * ⚠️ `order` stays the DEFAULT at the callsite, and it is not an arbitrary
 * choice: it is the real in-game sequence, which is the only view in which a
 * curriculum can be judged (does the second rook board follow from the first?).
 * `tier` answers a different question — "where are my hard boards?" — and the
 * mockup asked for it, so both exist and neither is hidden.
 *
 * Both fall back to the id as the final tie-break so a re-render can never
 * reshuffle two otherwise-equal rows under the author's cursor.
 */
export function sortLibrary<T extends LibraryRecord>(
  records: readonly T[],
  sort: LibrarySort,
): T[] {
  return [...records].sort((a, b) => {
    if (sort === "tier") {
      const byTier = tierRank(a.tier) - tierRank(b.tier);
      if (byTier !== 0) return byTier;
    }
    return a.order - b.order || (a.id ?? "").localeCompare(b.id ?? "");
  });
}
