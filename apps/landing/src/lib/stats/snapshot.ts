import { unstable_cache } from "next/cache";

import { bump, noteGeneratedAt } from "./instrument";

import { getPublicStats, getSurfaceBreakdown, type SurfaceBreakdown } from "./aggregator";
import { DEFAULT_STATS_FILTERS, type StatsFilters } from "./filters";
import { readPlayersCensus, type PlayersCensus } from "./players-census";
import type { PublicStats } from "./types";

/**
 * The ONE deliberate cache layer for `/stats`.
 *
 * ```
 *   Supabase fetch (cache: "no-store")  →  aggregator  →  THIS  →  UI
 * ```
 *
 * ⛔ **Never** the other shape. Letting Next's implicit `fetch` cache stay on
 * *and* wrapping the aggregator gives two TTLs stacked on top of each other,
 * with only one of them visible in the code and neither of them purged by a
 * deploy. The `no-store` in `lib/supabase/server.ts` is what keeps the lower
 * layer inert; there is a test that both facts still hold.
 *
 * ⛔ The tag is **`"public-stats"`**, never `"content"` — that one is the
 * puzzle catalogue and reusing it already produced a false green once.
 */

/** 900 s. The TTL is a FLOOR, not a ceiling: with stale-while-revalidate the
 *  first request past the window still gets the old photo and only *triggers*
 *  the refresh. Measured under `revalidate: 3600`, a snapshot survived 5 h 22
 *  min. Anyone reading this number as "at most 15 minutes old" is wrong. */
export const STATS_REVALIDATE_SECONDS = 900;

/** ⛔ One tag, and NOT `"content"`. */
export const STATS_CACHE_TAG = "public-stats";

/** Everything one render needs, frozen as a unit. */
export type StatsSnapshot = {
  stats: PublicStats;
  breakdown: SurfaceBreakdown;
};

/**
 * Injectable memoizer.
 *
 * `unstable_cache` throws "incrementalCache missing" outside a Next request, so
 * a test written straight against it would pass green over a memoizer that
 * never memoizes. Production passes `unstable_cache`; the tests pass a fake
 * that actually records keys and hits.
 */
export type CacheFactory<T> = (
  read: (...args: never[]) => Promise<T>,
  keyParts: string[],
  options: { revalidate: number; tags: string[] },
) => () => Promise<T>;

/**
 * Cache key for a snapshot.
 *
 * ⚠️ `surface` and `container` and NOTHING else. `locale` is formatting: adding
 * it would store the same numbers once per language and let two readers hold
 * different snapshots of the same moment. There is a test.
 */
export function snapshotKeyParts(filters: StatsFilters): string[] {
  return [STATS_CACHE_TAG, filters.surface, filters.container];
}

/** ⚠️ The census key carries NO filters. The census is global, so folding it
 *  into a filtered entry would store the same payload once per combination and
 *  let two views hold different hours of it. */
export const CENSUS_KEY_PARTS = [STATS_CACHE_TAG, "census"] as const;

/**
 * Read the whole snapshot in ONE cached unit.
 *
 * **Option A of the two the plan asked us to weigh, and the reason is
 * coherence, not laziness.** The Learn/Play/Total row needs install counts for
 * three surfaces. Composing it from three *separately cached* entries (option
 * B) would let the three rows of that table come from three different
 * regenerations — a table whose own rows disagree, inside a single view. One
 * entry means one `generatedAt`, one invalidation, and three numbers that were
 * true at the same instant.
 *
 * **Cost: 11 RPC calls per regeneration** (8 for the dashboard + 3 for the
 * breakdown, all of them `stats_install_counts`), plus the on-chain block. A
 * cache HIT costs zero of them.
 */
export function createSnapshotLoader(
  cache: CacheFactory<StatsSnapshot>,
  filters: StatsFilters = DEFAULT_STATS_FILTERS,
  read: () => Promise<StatsSnapshot> = async () => {
    // Inside the cached callback ON PURPOSE: a cached value returned without
    // running this must not move the counter, or the diagnostic would report
    // work that never happened.
    bump("snapshotReads");
    const [stats, breakdown] = await Promise.all([
      getPublicStats(filters),
      getSurfaceBreakdown(filters.container),
    ]);
    noteGeneratedAt(stats.generatedAt);
    return { stats, breakdown };
  },
): () => Promise<StatsSnapshot> {
  return cache(read, snapshotKeyParts(filters), {
    revalidate: STATS_REVALIDATE_SECONDS,
    tags: [STATS_CACHE_TAG],
  });
}

/**
 * The census, on its own entry and its own clock.
 *
 * `asOf` is stamped INSIDE `readPlayersCensus`, so it freezes together with the
 * rows and the total. The page's `generatedAt` describes a DIFFERENT snapshot —
 * rendering it beside these numbers would be a correct time attached to the
 * wrong data.
 *
 * ⚠️ A degraded result caches like any other, so a transient outage hides the
 * table for up to the TTL. That is deliberate: bypassing the cache on failure
 * trades it for a retry storm against a database that is already unwell. The
 * view always shows the age, so a stuck snapshot is visible rather than silent.
 */
export function createCensusLoader(
  cache: CacheFactory<PlayersCensus>,
  read: () => Promise<PlayersCensus> = () => readPlayersCensus(),
): () => Promise<PlayersCensus> {
  return cache(read, [...CENSUS_KEY_PARTS], {
    revalidate: STATS_REVALIDATE_SECONDS,
    tags: [STATS_CACHE_TAG],
  });
}

/* ── Production loaders ─────────────────────────────────────────────────────
   ⚠️ The wrappers are built ONCE and memoised at module scope, NOT per
   request.

   The previous version called `createSnapshotLoader(unstable_cache, filters)()`
   inside the request, which handed `unstable_cache` a brand-new closure every
   time. Next derives part of the entry's identity from the callback it is
   given, so a fresh closure per request is a plausible way to mint a fresh
   entry per request — and it is trivially avoidable. Nine filter combinations
   means at most nine wrappers, built lazily and kept.

   The key is normalised through `snapshotKeyParts`, so two equivalent spellings
   of the same filters cannot land on two entries. */

const snapshotLoaders = new Map<string, () => Promise<StatsSnapshot>>();

export function loadStatsSnapshot(filters: StatsFilters): Promise<StatsSnapshot> {
  const key = snapshotKeyParts(filters).join("::");
  let loader = snapshotLoaders.get(key);
  if (!loader) {
    loader = createSnapshotLoader(
      unstable_cache as unknown as CacheFactory<StatsSnapshot>,
      filters,
    );
    snapshotLoaders.set(key, loader);
  }
  return loader();
}

let censusLoader: (() => Promise<PlayersCensus>) | null = null;

export function loadPlayersCensus(): Promise<PlayersCensus> {
  if (!censusLoader) {
    censusLoader = createCensusLoader(
      unstable_cache as unknown as CacheFactory<PlayersCensus>,
    );
  }
  return censusLoader();
}
