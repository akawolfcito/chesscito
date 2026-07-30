import { unstable_cache } from "next/cache";

import {
  PLAYERS_TABLE_CEILING,
  fetchFullLeaderboardFromDb,
  fetchLeaderboardTotalFromDb,
  type LeaderboardRow,
} from "@/lib/supabase/queries";
import {
  deriveAvatarVariant,
  deriveRowId,
} from "@/lib/identity/identity-lite";
// Type-only: `public-aggregator` imports this module, so a value import here
// would close a require cycle. `import type` is erased at compile time.
import type { LeaderboardIdentityRow } from "./public-aggregator";

/**
 * The players census behind the /stats table — every ranked player, plus the
 * population figure, frozen together.
 *
 * Two independent reads feed it and they fail separately, so the shape has to
 * carry four distinguishable outcomes rather than three. The one that is easy
 * to lose is the difference between an empty board and a failed read: both
 * leave `rows` empty, and only `rowsRead` says which happened.
 */
export type PlayersCensus = {
  /** Always an array, in the view's order. Empty means either "no ranked
   *  players" or "the read failed" — `rowsRead` disambiguates. */
  rows: LeaderboardIdentityRow[];
  /** The population, from the same counting function that feeds the Leaders
   *  hero. `null` = the count read failed; it is NEVER `rows.length`, which is
   *  the defect that once announced "10 players" to a player ranked 13th. */
  total: number | null;
  /** Availability of the ROWS read, kept even when the UI hides the section.
   *  `[]` by empty population and `[]` by error are not semantically equal. */
  rowsRead: "ok" | "unavailable";
};

export const EMPTY_PLAYERS_CENSUS: PlayersCensus = {
  rows: [],
  total: null,
  rowsRead: "unavailable",
};

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
    // `has_onchain` was appended to the view in 2026-06; deployments predating
    // it omit the column, and absence means "no on-chain score", not unknown.
    hasOnchain: row.has_onchain ?? false,
  };
}

/**
 * Read both halves and compose them.
 *
 * `Promise.allSettled` so one failure cannot blank the other — a count that
 * survives a failed row read is still worth showing, and rows that survive a
 * failed count are worth far more than the number that would have labelled
 * them.
 *
 * ⛔ NOTHING here deduplicates. `aggregateTopMinters` dedupes by `rowId` on
 * purpose because it rolls a feed up into per-minter totals; this is a census,
 * and the same move would delete players.
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

  if (rawRows === null) {
    return { rows: [], total, rowsRead: "unavailable" };
  }

  // `.map` preserves order, which is the view's ORDER BY rank. The aggregator
  // must not re-sort: the ordering rule (including its tiebreak) lives in SQL,
  // and a second sort here could disagree with the rank column beside it.
  return { rows: rawRows.map(toIdentityRow), total, rowsRead: "ok" };
}

// ---------------------------------------------------------------------------
// Cache — its own entry, and one frozen unit
// ---------------------------------------------------------------------------

/** Cache key. Deliberately free of `surface` / `container`: the census is
 *  global, so folding it into the page's filtered entry would store the same
 *  payload once per combination and let two views hold different hours. */
export const PLAYERS_CENSUS_CACHE_KEY = ["stats-players-census"] as const;

/** Matches the page's own `revalidate` so the census never ages on a different
 *  clock from the blocks around it. */
export const PLAYERS_CENSUS_REVALIDATE_SECONDS = 3600;

/**
 * Injectable memoizer. Exists because `unstable_cache` throws
 * "incrementalCache missing" outside a Next request, so in vitest there is no
 * cache to exercise and a test written straight against it would pass green
 * over a memoizer that never memoizes. Production passes `unstable_cache`.
 */
export type CensusCacheFactory = (
  read: () => Promise<PlayersCensus>,
  keyParts: string[],
  options: { revalidate: number },
) => () => Promise<PlayersCensus>;

/**
 * Build the cached loader.
 *
 * The composition in `readPlayersCensus` happens INSIDE the cached function, so
 * what lands in the entry is one already-resolved answer. Caching the two reads
 * separately would let a consumer pair rows from one refresh with a total from
 * the next and show 17 rows under a total of 18 — drift inside a single view,
 * which is a different and worse thing than drift against the live hero.
 *
 * ⚠️ A degraded result caches like any other, so a transient outage hides the
 * table for up to an hour. That is the same behaviour every other block on this
 * page already has (the aggregator caches its per-field nulls too); bypassing
 * the cache on failure would trade it for a retry storm against a database that
 * is already unwell.
 */
export function createPlayersCensusLoader(
  cache: CensusCacheFactory,
  read: () => Promise<PlayersCensus> = () => readPlayersCensus(),
): () => Promise<PlayersCensus> {
  return cache(read, [...PLAYERS_CENSUS_CACHE_KEY], {
    revalidate: PLAYERS_CENSUS_REVALIDATE_SECONDS,
  });
}

/** The production loader. Takes no arguments on purpose: a loader that accepted
 *  filters could be called with them, and eventually would be. */
export const loadPlayersCensus = createPlayersCensusLoader(
  unstable_cache as unknown as CensusCacheFactory,
);
