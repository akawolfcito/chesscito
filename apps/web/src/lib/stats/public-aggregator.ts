import { getSupabaseServer } from "@/lib/supabase/server";
import {
  fetchLeaderboardFromDb,
  type LeaderboardRow,
  type VictoryRow,
} from "@/lib/supabase/queries";

/**
 * Read-only aggregator that powers the public `/stats` page.
 *
 * Sources: Supabase tables already populated by existing flows
 * (`victories`, `welcome_pack_claims`, `analytics_events`,
 * `coach_analyses`) plus the `leaderboard_v` view via the existing
 * `fetchLeaderboardFromDb` helper. NO chain reads, NO new schema, NO
 * indexer / Dune / Blockscout. Each query runs in isolation under
 * `Promise.allSettled` so a single failure cannot blank the page.
 *
 * Numeric fields are `number | null` — `null` means "data unavailable"
 * and renders as an em-dash placeholder in the view layer. Arrays
 * default to `[]` (empty list, not error).
 */

export type DifficultyTally = {
  easy: number;
  medium: number;
  hard: number;
};

/** Per-day aggregate for the trailing 30-day activity chart. `date`
 *  is a `YYYY-MM-DD` UTC string; `sessions` is the distinct
 *  session_id count for that calendar day; `mints` is the number
 *  of Victory NFTs minted that day. Buckets are dense (every day in
 *  the window is present, missing days come through as zeros) so
 *  the chart consumer can index by position without holes. */
export type DailyBucket = {
  date: string;
  sessions: number;
  mints: number;
};

export type PublicStats = {
  totalVictories: number | null;
  victories7d: number | null;
  victories30d: number | null;
  uniqueMintersLifetime: number | null;
  victoriesByDifficulty: DifficultyTally | null;
  welcomePacksLifetime: number | null;
  welcomePacks7d: number | null;
  /** Approx. unique sessions; analytics_events keyed by opaque
   *  session_id (not wallet). Sub-counts cross-device users. */
  activeSessions7d: number | null;
  /** Same caveat as activeSessions7d. */
  activeSessions30d: number | null;
  /** Computed but currently hidden from the page — kept here so a
   *  follow-up commit can wire it in without touching the aggregator. */
  coachAnalysesLifetime: number | null;
  coachAnalyses7d: number | null;
  hallOfFame: VictoryRow[];
  leaderboardTop10: LeaderboardRow[];
  /** 30 entries, oldest day first. Empty array if either underlying
   *  query fails — the consumer hides the chart entirely rather than
   *  rendering a misleading flat line. */
  activityTrend30d: DailyBucket[];
  /** ISO timestamp at aggregation time. Used by the page as the
   *  "as of" label so a stale CDN snapshot is identifiable. */
  generatedAt: string;
};

export const EMPTY_PUBLIC_STATS: PublicStats = {
  totalVictories: null,
  victories7d: null,
  victories30d: null,
  uniqueMintersLifetime: null,
  victoriesByDifficulty: null,
  welcomePacksLifetime: null,
  welcomePacks7d: null,
  activeSessions7d: null,
  activeSessions30d: null,
  coachAnalysesLifetime: null,
  coachAnalyses7d: null,
  hallOfFame: [],
  leaderboardTop10: [],
  activityTrend30d: [],
  generatedAt: new Date(0).toISOString(),
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Upper bound for PostgREST `range` on distinct-count queries.
 *  Supabase Cloud's default `db-default-rows-limit` (currently 1000)
 *  would silently truncate the row set and undercount distinct
 *  values — explicit range bypasses that. Tune up if `victories` or
 *  `analytics_events` row count approaches this ceiling. */
const DISTINCT_QUERY_MAX_ROWS = 9_999;

type CountResult = { count: number | null; error?: unknown };
type DataResult<T> = { data: T[] | null; error?: unknown };

function extractCount(
  res: PromiseSettledResult<CountResult>,
): number | null {
  if (res.status !== "fulfilled") return null;
  if (res.value?.error) return null;
  return typeof res.value?.count === "number" ? res.value.count : null;
}

function extractDistinctCount<T extends Record<string, unknown>>(
  res: PromiseSettledResult<DataResult<T>>,
  key: keyof T,
): number | null {
  if (res.status !== "fulfilled") return null;
  if (res.value?.error) return null;
  const rows = res.value?.data;
  if (!Array.isArray(rows)) return null;
  const set = new Set<unknown>();
  for (const row of rows) set.add(row[key]);
  return set.size;
}

function extractRows<T>(res: PromiseSettledResult<DataResult<T>>): T[] {
  if (res.status !== "fulfilled") return [];
  if (res.value?.error) return [];
  return Array.isArray(res.value?.data) ? res.value.data : [];
}

/**
 * Build a dense 30-day window (oldest UTC day first → today) of
 * session + mint counts. Days with no activity come through as
 * zeros so the chart consumer can index by position without
 * skipping holes. Distinct session_id per day is computed in JS
 * over the same row set the lifetime distinct count uses, no extra
 * query.
 */
function computeActivityTrend(
  sessionRows: { session_id?: string | null; created_at?: string | null }[]
    | null
    | undefined,
  mintRows: { minted_at?: string | null }[] | null | undefined,
): DailyBucket[] {
  type Bucket = { sessions: Set<string>; mints: number };
  const buckets = new Map<string, Bucket>();

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let offset = 29; offset >= 0; offset -= 1) {
    const d = new Date(today.getTime() - offset * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, { sessions: new Set(), mints: 0 });
  }

  if (Array.isArray(sessionRows)) {
    for (const row of sessionRows) {
      const ts = typeof row?.created_at === "string" ? row.created_at : null;
      const sid = typeof row?.session_id === "string" ? row.session_id : null;
      if (!ts || !sid) continue;
      const key = ts.slice(0, 10);
      const b = buckets.get(key);
      if (b) b.sessions.add(sid);
    }
  }

  if (Array.isArray(mintRows)) {
    for (const row of mintRows) {
      const ts = typeof row?.minted_at === "string" ? row.minted_at : null;
      if (!ts) continue;
      const key = ts.slice(0, 10);
      const b = buckets.get(key);
      if (b) b.mints += 1;
    }
  }

  return Array.from(buckets.entries()).map(([date, b]) => ({
    date,
    sessions: b.sessions.size,
    mints: b.mints,
  }));
}

function tallyDifficulty(
  res: PromiseSettledResult<DataResult<{ difficulty: number }>>,
): DifficultyTally | null {
  if (res.status !== "fulfilled") return null;
  if (res.value?.error) return null;
  const rows = res.value?.data;
  if (!Array.isArray(rows)) return null;
  const tally: DifficultyTally = { easy: 0, medium: 0, hard: 0 };
  for (const row of rows) {
    if (row.difficulty === 1) tally.easy += 1;
    else if (row.difficulty === 2) tally.medium += 1;
    else if (row.difficulty === 3) tally.hard += 1;
    // Anything else (legacy / unmapped) silently dropped — the
    // tally documents only the canonical difficulty bands.
  }
  return tally;
}

export async function getPublicStats(): Promise<PublicStats> {
  const supabase = getSupabaseServer();
  if (!supabase) {
    return { ...EMPTY_PUBLIC_STATS, generatedAt: new Date().toISOString() };
  }

  const now = new Date();
  const generatedAt = now.toISOString();
  const since7d = new Date(now.getTime() - 7 * DAY_MS).toISOString();
  const since30d = new Date(now.getTime() - 30 * DAY_MS).toISOString();

  const results = await Promise.allSettled([
    // 0. Total victories lifetime — head:true skips row payload, count only.
    supabase
      .from("victories")
      .select("*", { count: "exact", head: true }) as unknown as Promise<CountResult>,
    // 1. Victories 7d
    supabase
      .from("victories")
      .select("*", { count: "exact", head: true })
      .gte("minted_at", since7d) as unknown as Promise<CountResult>,
    // 2. Victories 30d
    supabase
      .from("victories")
      .select("*", { count: "exact", head: true })
      .gte("minted_at", since30d) as unknown as Promise<CountResult>,
    // 3. Unique minter wallets — fetch player column, dedupe in JS.
    //    Count-distinct via PostgREST requires an RPC; for current
    //    volume (low thousands at most), in-app dedupe is acceptable.
    //    Explicit range bypasses the silent 1000-row default cap.
    supabase
      .from("victories")
      .select("player")
      .range(0, DISTINCT_QUERY_MAX_ROWS) as unknown as Promise<
      DataResult<{ player: string }>
    >,
    // 4. Difficulty distribution — same defensive range so the tally
    //    matches `totalVictories` instead of silently truncating.
    supabase
      .from("victories")
      .select("difficulty")
      .range(0, DISTINCT_QUERY_MAX_ROWS) as unknown as Promise<
      DataResult<{ difficulty: number }>
    >,
    // 5. Welcome Packs lifetime
    supabase
      .from("welcome_pack_claims")
      .select("*", { count: "exact", head: true }) as unknown as Promise<CountResult>,
    // 6. Welcome Packs 7d
    supabase
      .from("welcome_pack_claims")
      .select("*", { count: "exact", head: true })
      .gte("claimed_at", since7d) as unknown as Promise<CountResult>,
    // 7. Active sessions 7d — distinct session_id from analytics_events.
    //    Table has a 90d rolling cleanup, so 30d is the practical max.
    //    Range bound matches the distinct-count discipline; if
    //    analytics volume passes the ceiling we'll need batched scans.
    supabase
      .from("analytics_events")
      .select("session_id")
      .gte("created_at", since7d)
      .range(0, DISTINCT_QUERY_MAX_ROWS) as unknown as Promise<
      DataResult<{ session_id: string }>
    >,
    // 8. Active sessions 30d — also feeds the daily session bucket
    //    in the activity trend chart, so select `created_at` too.
    //    extractDistinctCount only reads `session_id` and ignores
    //    the extra column.
    supabase
      .from("analytics_events")
      .select("session_id, created_at")
      .gte("created_at", since30d)
      .range(0, DISTINCT_QUERY_MAX_ROWS) as unknown as Promise<
      DataResult<{ session_id: string; created_at: string }>
    >,
    // 9. Coach analyses lifetime
    supabase
      .from("coach_analyses")
      .select("*", { count: "exact", head: true }) as unknown as Promise<CountResult>,
    // 10. Coach analyses 7d
    supabase
      .from("coach_analyses")
      .select("*", { count: "exact", head: true })
      .gte("created_at", since7d) as unknown as Promise<CountResult>,
    // 11. Hall of Fame — 10 most recent mints
    supabase
      .from("victories")
      .select(
        "token_id, player, difficulty, total_moves, time_ms, tx_hash, minted_at",
      )
      .order("minted_at", { ascending: false })
      .limit(10) as unknown as Promise<DataResult<VictoryRow>>,
    // 12. Leaderboard top 10 — reuses the existing helper which
    //     prefers `get_leaderboard` RPC and falls back to view.
    fetchLeaderboardFromDb(),
    // 13. Daily mints over the last 30 days — feeds the activity
    //     trend chart's mint series. Only `minted_at` is needed;
    //     bucketing into per-day counts happens in JS.
    supabase
      .from("victories")
      .select("minted_at")
      .gte("minted_at", since30d)
      .range(0, DISTINCT_QUERY_MAX_ROWS) as unknown as Promise<
      DataResult<{ minted_at: string }>
    >,
  ]);

  const [
    totalVictoriesRes,
    victories7dRes,
    victories30dRes,
    uniqueMintersRes,
    difficultyRes,
    welcomePacksLifetimeRes,
    welcomePacks7dRes,
    sessions7dRes,
    sessions30dRes,
    coachLifetimeRes,
    coach7dRes,
    hallOfFameRes,
    leaderboardRes,
    mintsTrendRes,
  ] = results;

  // Activity trend: both queries must have fulfilled with arrays;
  // any failure on either side produces an empty trend so the
  // consumer can hide the chart instead of drawing a misleading
  // flat line with one-sided data.
  const sessionTrendRows =
    sessions30dRes.status === "fulfilled" &&
    Array.isArray(
      (sessions30dRes.value as DataResult<{ session_id: string; created_at: string }>)?.data,
    )
      ? (sessions30dRes.value as DataResult<{ session_id: string; created_at: string }>).data!
      : null;
  const mintTrendRows =
    mintsTrendRes.status === "fulfilled" &&
    Array.isArray((mintsTrendRes.value as DataResult<{ minted_at: string }>)?.data)
      ? (mintsTrendRes.value as DataResult<{ minted_at: string }>).data!
      : null;
  const activityTrend30d =
    sessionTrendRows == null && mintTrendRows == null
      ? []
      : computeActivityTrend(sessionTrendRows, mintTrendRows);

  return {
    totalVictories: extractCount(totalVictoriesRes as PromiseSettledResult<CountResult>),
    victories7d: extractCount(victories7dRes as PromiseSettledResult<CountResult>),
    victories30d: extractCount(victories30dRes as PromiseSettledResult<CountResult>),
    uniqueMintersLifetime: extractDistinctCount(
      uniqueMintersRes as PromiseSettledResult<DataResult<{ player: string }>>,
      "player",
    ),
    victoriesByDifficulty: tallyDifficulty(
      difficultyRes as PromiseSettledResult<
        DataResult<{ difficulty: number }>
      >,
    ),
    welcomePacksLifetime: extractCount(
      welcomePacksLifetimeRes as PromiseSettledResult<CountResult>,
    ),
    welcomePacks7d: extractCount(welcomePacks7dRes as PromiseSettledResult<CountResult>),
    activeSessions7d: extractDistinctCount(
      sessions7dRes as PromiseSettledResult<
        DataResult<{ session_id: string }>
      >,
      "session_id",
    ),
    activeSessions30d: extractDistinctCount(
      sessions30dRes as PromiseSettledResult<
        DataResult<{ session_id: string }>
      >,
      "session_id",
    ),
    coachAnalysesLifetime: extractCount(
      coachLifetimeRes as PromiseSettledResult<CountResult>,
    ),
    coachAnalyses7d: extractCount(coach7dRes as PromiseSettledResult<CountResult>),
    hallOfFame: extractRows(
      hallOfFameRes as PromiseSettledResult<DataResult<VictoryRow>>,
    ),
    leaderboardTop10:
      leaderboardRes.status === "fulfilled"
        ? leaderboardRes.value.slice(0, 10)
        : [],
    activityTrend30d,
    generatedAt,
  };
}
