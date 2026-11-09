import { getSupabaseServer } from "@/lib/supabase/server";

import { deriveAvatarVariant, deriveRowId, type AvatarVariant } from "./identity";

/**
 * The players census behind the /stats table — every ranked player, plus the
 * population figure, frozen together.
 *
 * Port of `apps/web/src/lib/stats/players-census.ts` **plus** the two query
 * helpers it used to import from `lib/supabase/queries` (the landing has no
 * such module, and Leaders — the other consumer over there — is not moving).
 *
 * ⛔ **The `unstable_cache` wiring did NOT travel.** Phase C's cache policy is
 * explicit: no `unstable_cache`, no `revalidate`, no `revalidateTag`. The
 * memoizer factory is Phase E's job; what lands here is the uncached read, so
 * the numbers on screen are the numbers in the database.
 */

/** A leaderboard row with NO wallet. Identity Lite. */
export type LeaderboardIdentityRow = {
  rank: number;
  rowId: string;
  variant: AvatarVariant;
  totalScore: number;
  isVerified: boolean;
  hasOnchain: boolean;
};

type LeaderboardRow = {
  rank: number;
  player: string;
  total_score: number;
  is_verified: boolean;
  /** Appended to the view 2026-06; older deployments omit it, and absence
   *  means "no on-chain score", not unknown. */
  has_onchain?: boolean;
};

/**
 * Two independent reads feed the census and they fail separately, so the shape
 * carries four distinguishable outcomes rather than three. The one that is easy
 * to lose is the difference between an empty board and a failed read: both
 * leave `rows` empty, and only `rowsRead` says which happened.
 */
export type PlayersCensus = {
  rows: LeaderboardIdentityRow[];
  /** The population, from the same relation the Leaders hero counts. `null` =
   *  the count read failed; it is NEVER `rows.length`, which is the defect that
   *  once announced "10 players" to a player ranked 13th. */
  total: number | null;
  /** Availability of the ROWS read. `[]` by empty population and `[]` by error
   *  are not semantically equal. */
  rowsRead: "ok" | "unavailable";
  /** When THIS snapshot was composed. Non-null even on a failed read, because
   *  the rows-down / total-alive case still carries a valid total that deserves
   *  its stamp. */
  asOf: string;
};

export const EMPTY_PLAYERS_CENSUS: PlayersCensus = {
  rows: [],
  total: null,
  rowsRead: "unavailable",
  asOf: new Date(0).toISOString(),
};

export const PLAYERS_TABLE_CEILING = 500;

/** The uncut ranking. Reads `leaderboard_full_v` — the SAME relation the count
 *  below uses. That shared source is the entire point: the census exists so the
 *  population figure can be counted by hand, and a table fed from anywhere else
 *  would eventually contradict it. */
async function fetchFullLeaderboardFromDb(
  limit: number,
): Promise<LeaderboardRow[] | null> {
  const supabase = getSupabaseServer();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("leaderboard_full_v")
    .select("rank, player, total_score, is_verified, has_onchain")
    .order("rank", { ascending: true })
    .limit(limit);

  if (error) return null;
  return (data ?? []) as LeaderboardRow[];
}

async function fetchLeaderboardTotalFromDb(): Promise<number | null> {
  const supabase = getSupabaseServer();
  if (!supabase) return null;

  const { count, error } = await supabase
    .from("leaderboard_full_v")
    .select("player", { count: "exact", head: true });

  if (error) return null;
  return count ?? null;
}

/**
 * Map a view row to its Identity Lite form, DISCARDING the wallet.
 *
 * `rank` is copied from the view rather than derived from position: the census
 * is paginated and can be truncated by the ceiling, and either one would make
 * an index-derived rank quietly wrong.
 */
function toIdentityRow(row: LeaderboardRow): LeaderboardIdentityRow {
  const wallet = row.player.toLowerCase();
  return {
    rank: row.rank,
    rowId: deriveRowId(wallet),
    variant: deriveAvatarVariant(wallet),
    totalScore: row.total_score,
    isVerified: row.is_verified,
    hasOnchain: row.has_onchain ?? false,
  };
}

/**
 * Read both halves and compose them.
 *
 * `Promise.allSettled` so one failure cannot blank the other — a count that
 * survives a failed row read is still worth showing, and rows that survive a
 * failed count are worth far more than the number that would have labelled them.
 *
 * ⛔ NOTHING here deduplicates. This is a census; deduping would delete players.
 */
export async function readPlayersCensus(
  ceiling: number = PLAYERS_TABLE_CEILING,
): Promise<PlayersCensus> {
  const [rowsResult, totalResult] = await Promise.allSettled([
    fetchFullLeaderboardFromDb(ceiling),
    fetchLeaderboardTotalFromDb(),
  ]);

  const rawRows = rowsResult.status === "fulfilled" ? rowsResult.value : null;
  const total = totalResult.status === "fulfilled" ? totalResult.value : null;
  // Stamped after both reads settle so it freezes together with the rows and
  // the total instead of drifting from them.
  const asOf = new Date().toISOString();

  if (rawRows === null) {
    return { rows: [], total, rowsRead: "unavailable", asOf };
  }

  // `.map` preserves order, which is the view's ORDER BY rank. Do NOT re-sort:
  // the ordering rule (including its tiebreak) lives in SQL, and a second sort
  // here could disagree with the rank column beside it.
  return { rows: rawRows.map(toIdentityRow), total, rowsRead: "ok", asOf };
}
