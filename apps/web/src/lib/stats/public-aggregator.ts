import { getSupabaseServer } from "@/lib/supabase/server";
import {
  fetchLeaderboardFromDb,
  type VictoryRow,
} from "@/lib/supabase/queries";
import {
  deriveAvatarVariant,
  deriveRowId,
  type AvatarVariant,
} from "@/lib/identity/identity-lite";
import {
  EMPTY_ONCHAIN_STATS,
  fetchOnchainStats,
  type OnchainStats,
  type StatsDb,
} from "./onchain";
import {
  computeAccessFunnel,
  computeAccountLifecycle,
  computeActivation,
  computeDailyFocusFunnel,
  computeHabitDepth,
  computeRetention,
  computeTopCountries,
  UNMEASURED_ACCOUNT_ACTIVITY,
  type AccessFunnel,
  type AccountLifecycle,
  type ActivationFunnel,
  type CountryCount,
  type DailyFocusFunnel,
  type HabitDepth,
  type MeasuredAccountLifecycle,
  type Retention,
} from "./funnels";
import {
  ALL_ACCESS_ALIASES,
  ALL_DAILY_FOCUS_ALIASES,
  ALL_FUNNEL_ALIASES,
} from "@/lib/analytics/canonical-events";
import {
  DEFAULT_STATS_FILTERS,
  type StatsFilters,
} from "./filters";

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

/** Identity Lite: a top-minter rollup with NO wallet. `rowId` is an opaque
 *  dedupe/key; `variant` drives the avatar + (client-formatted) nickname. */
export type MinterIdentityRow = {
  rowId: string;
  variant: AvatarVariant;
  mintCount: number;
  lastMintedAt: string;
};

/** Identity Lite: a leaderboard row with NO wallet. */
export type LeaderboardIdentityRow = {
  rank: number;
  rowId: string;
  variant: AvatarVariant;
  totalScore: number;
  isVerified: boolean;
  hasOnchain: boolean;
};

/**
 * Roll up the recent-mints feed into per-minter counts, deriving the Identity
 * Lite `variant` + opaque `rowId` from each wallet and DISCARDING the wallet.
 * Sort by mint count desc, tiebreak by most-recent mint. Server-side so no raw
 * wallet ever reaches the /stats client payload.
 */
export function aggregateTopMinters(
  rows: Array<{ player: string; minted_at: string }>,
  limit = 10,
): MinterIdentityRow[] {
  const byRow = new Map<string, MinterIdentityRow>();
  for (const row of rows) {
    const wallet = row.player.toLowerCase();
    const rowId = deriveRowId(wallet);
    const existing = byRow.get(rowId);
    if (existing) {
      existing.mintCount += 1;
      if (Date.parse(row.minted_at) > Date.parse(existing.lastMintedAt)) {
        existing.lastMintedAt = row.minted_at;
      }
    } else {
      byRow.set(rowId, {
        rowId,
        variant: deriveAvatarVariant(wallet),
        mintCount: 1,
        lastMintedAt: row.minted_at,
      });
    }
  }
  return Array.from(byRow.values())
    .sort((a, b) => {
      if (b.mintCount !== a.mintCount) return b.mintCount - a.mintCount;
      return Date.parse(b.lastMintedAt) - Date.parse(a.lastMintedAt);
    })
    .slice(0, limit);
}

/** Per-day aggregate for the trailing 30-day activity chart. `date`
 *  is a `YYYY-MM-DD` UTC string; `sessions` is the distinct
 *  session_id count for that calendar day; `mints` is the number
 *  of Victory NFTs minted that day. Buckets are dense (every day in
 *  the window is present, missing days come through as zeros) so
 *  the chart consumer can index by position without holes.
 *
 *  `newInstalls` + `returningInstalls` ALWAYS sum to `sessions`: they
 *  partition the same active set by whether the install's first-ever day is
 *  this day. An install with no `session_first_seen` row (it predates the
 *  cohort table) counts as returning — the conservative read, since it
 *  provably existed before. */
export type DailyBucket = {
  date: string;
  sessions: number;
  mints: number;
  newInstalls: number;
  returningInstalls: number;
};

/** Which reads hit the row ceiling. A truncated read makes its derived numbers
 *  LOWER BOUNDS, not counts — the page says so instead of printing a confident
 *  wrong figure. Empty `truncated` = every read came back whole. */
export type DataIntegrity = {
  truncated: string[];
  rowCeiling: number;
};

/** B2.1 — challenge link funnel counts for the public /stats page.
 *  Rates are intentionally excluded (misleading at early-stage volume). */
export type ChallengeFunnel = {
  opens: number | null;
  starts: number | null;
  completions: number | null;
  shares: number | null;
  continueToLite: number | null;
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
  /** Top minters, identity-only (no wallet). Aggregated server-side from the
   *  recent-mints feed. Identity Lite. */
  topMinters: MinterIdentityRow[];
  /** Top-10 leaderboard, identity-only (no wallet). Identity Lite. */
  leaderboardTop10: LeaderboardIdentityRow[];
  /** 30 entries, oldest day first. Empty array if either underlying
   *  query fails — the consumer hides the chart entirely rather than
   *  rendering a misleading flat line. */
  activityTrend30d: DailyBucket[];
  /** ISO timestamp at aggregation time. Used by the page as the
   *  "as of" label so a stale CDN snapshot is identifiable. */
  generatedAt: string;
  /** §8 on-chain block (MiniPay Stage-2). Per-method tx counts, unique
   *  on-chain users, Get Peones volume; roadmap fields stay null. */
  onchain: OnchainStats;
  /** B2.1 — challenge link funnel (last 30d, isLite events only).
   *  null when the underlying query fails. */
  challengeFunnel: ChallengeFunnel | null;
  /** Echo of the applied surface/container filters (drives the UI controls
   *  + the "as of, filtered by" label). */
  filters: StatsFilters;
  /** Distinct sessions that fired app_opened in the last 30d, under the
   *  active filters. null on query failure. Equals activation[0].sessions. */
  appOpens30d: number | null;
  /** TRAINING activation funnel (last 30d, filtered): distinct sessions per
   *  canonical step. null on query failure. Four steps — Daily lives in
   *  `dailyFocusFunnel` below, as a sibling and never as a fifth rung. */
  activation: ActivationFunnel | null;
  /** Daily Focus funnel (last 30d, filtered). Branches off the SAME first two
   *  steps as `activation`; a session may appear in both, one or neither. null
   *  on query failure. */
  dailyFocusFunnel: DailyFocusFunnel | null;
  /** Top countries by distinct sessions (last 30d, filtered). Empty on
   *  failure; null country is never included. */
  topCountries: CountryCount[];
  /** Rolling D1/D7 retention (filtered cohorts). null on query failure. */
  retention: Retention | null;
  /** Door-to-value funnel over the gate cohort (last 30d, filtered). null on
   *  query failure. */
  accessFunnel: AccessFunnel | null;
  /** New / active / dormant / inactive PEOPLE (keyed pseudonyms), not
   *  installs. null when the account table or the event scan is unavailable —
   *  a lifecycle without its denominator would be a guess. */
  accountLifecycle: AccountLifecycle | null;
  /** Distinct active days per install: how often people actually come back,
   *  which is what the 21-day habit means. null on query failure. */
  habitDepth: HabitDepth | null;
  /** Which reads were truncated by the row ceiling. Rendered as an explicit
   *  caveat so a partial read is never mistaken for a real decline. */
  dataIntegrity: DataIntegrity;
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
  topMinters: [],
  leaderboardTop10: [],
  activityTrend30d: [],
  generatedAt: new Date(0).toISOString(),
  onchain: EMPTY_ONCHAIN_STATS,
  challengeFunnel: null,
  filters: DEFAULT_STATS_FILTERS,
  appOpens30d: null,
  activation: null,
  dailyFocusFunnel: null,
  topCountries: [],
  retention: null,
  accessFunnel: null,
  accountLifecycle: null,
  habitDepth: null,
  dataIntegrity: { truncated: [], rowCeiling: 0 },
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight UTC of `now`, as an ISO string. "Arrived today" is a CALENDAR day
 *  and not a rolling 24 h — the two disagree by a full day's worth of signups
 *  every afternoon, and the label says "today". */
/** Keep only the activity half of a measured lifecycle. The head counts win
 *  over the ones derived from rows: they are exact and the row-derived pair
 *  agrees with them only while the read stays under the ceiling. */
function pickAccountActivity(life: MeasuredAccountLifecycle) {
  return {
    active7d: life.active7d,
    dormant: life.dormant,
    inactive: life.inactive,
    resurrected7d: life.resurrected7d,
  };
}

function startOfUtcDay(now: Date): string {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * How many rows PostgREST will actually hand back, no matter what we ask for.
 *
 * ⛔ AN EXPLICIT `.range()` DOES NOT RAISE THIS. Supabase enforces `db-max-rows`
 * server-side, and it wins over the request. Measured 2026-08-04 against the
 * production REST endpoint:
 *
 *     Range: 0-9999     → 206 · 1000 rows · Content-Range 0-999/3066
 *     Range: 0-1500     → 206 · 1000 rows · Content-Range 0-999/3066
 *     Range: 1000-2999  → 206 · 1000 rows · Content-Range 1000-1999/3066
 *
 * The previous value here was 9,999 with a comment claiming the explicit range
 * bypassed the cap. It never did. Every ranged read is ORDERED newest-first, so
 * the cap turned "last 30 days" into "last 15 minutes" and the page published
 * 46 sessions against a real 3,928. Full evidence:
 * `docs/audits/2026-08-04-public-stats-accuracy-audit.md` §9.
 *
 * The third measurement above is the way out: paging works. Counting in SQL is
 * the better one — see §15 of the same audit.
 */
const POSTGREST_MAX_ROWS = 1_000;

/** Rows a `.range(0, ROW_CEILING - 1)` read can return. A result of exactly
 *  this size means PostgREST stopped at the ceiling and there is more behind
 *  it. It must equal `POSTGREST_MAX_ROWS`: the old code compared against
 *  10,000, a size the server can never return, so the check was unsatisfiable
 *  and the page never warned anyone. */
const ROW_CEILING = POSTGREST_MAX_ROWS;

/** The `to` bound for a ranged read — inclusive, hence the −1. */
const RANGE_TO = POSTGREST_MAX_ROWS - 1;

/** True when a read came back exactly full — i.e. it was almost certainly cut
 *  off. Every ranged read is ORDERED newest-first, so what a truncated read
 *  drops is the OLDEST tail. That is survivable for a lifetime figure (it
 *  degrades into a lower bound) and FATAL for a windowed one (it silently
 *  narrows the window), which is why the windowed metrics go null instead. */
function hitCeiling(rows: unknown): boolean {
  return Array.isArray(rows) && rows.length >= ROW_CEILING;
}

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
 *
 * `firstSeenRows` partitions each day's active installs into new vs
 * returning. It is derived from the SAME active set rather than counted
 * independently, so the two series always add up to `sessions` — a chart that
 * cannot contradict its own total.
 */
function computeActivityTrend(
  sessionRows: { session_id?: string | null; created_at?: string | null }[]
    | null
    | undefined,
  mintRows: { minted_at?: string | null }[] | null | undefined,
  firstSeenRows?:
    | { session_id?: string | null; first_seen?: string | null }[]
    | null,
): DailyBucket[] {
  type Bucket = { sessions: Set<string>; mints: number };
  const buckets = new Map<string, Bucket>();

  /** install id → the UTC day it was first ever seen. */
  const firstSeenDay = new Map<string, string>();
  if (Array.isArray(firstSeenRows)) {
    for (const row of firstSeenRows) {
      const sid = typeof row?.session_id === "string" ? row.session_id : null;
      const fs = typeof row?.first_seen === "string" ? row.first_seen : null;
      if (sid && fs) firstSeenDay.set(sid, fs.slice(0, 10));
    }
  }

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

  return Array.from(buckets.entries()).map(([date, b]) => {
    let newInstalls = 0;
    for (const sid of b.sessions) {
      if (firstSeenDay.get(sid) === date) newInstalls += 1;
    }
    return {
      date,
      sessions: b.sessions.size,
      mints: b.mints,
      newInstalls,
      returningInstalls: b.sessions.size - newInstalls,
    };
  });
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

const CHALLENGE_EVENTS = [
  "challenge_link_opened",
  "challenge_started",
  "challenge_completed",
  "challenge_shared",
  "challenge_continue_to_lite",
] as const;

type ChallengeEvent = (typeof CHALLENGE_EVENTS)[number];

function extractChallengeFunnel(res: {
  data: Array<{ event: string; props: unknown }> | null;
  error: unknown;
}): ChallengeFunnel | null {
  if (res.error || !Array.isArray(res.data)) return null;
  const counts: Record<ChallengeEvent, number> = {
    challenge_link_opened: 0,
    challenge_started: 0,
    challenge_completed: 0,
    challenge_shared: 0,
    challenge_continue_to_lite: 0,
  };
  for (const row of res.data) {
    const p = row.props;
    if (
      p === null ||
      typeof p !== "object" ||
      Array.isArray(p) ||
      (p as Record<string, unknown>)["isLite"] !== true
    )
      continue;
    const ev = row.event as ChallengeEvent;
    if (ev in counts) counts[ev]++;
  }
  return {
    opens: counts["challenge_link_opened"],
    starts: counts["challenge_started"],
    completions: counts["challenge_completed"],
    shares: counts["challenge_shared"],
    continueToLite: counts["challenge_continue_to_lite"],
  };
}

export async function getPublicStats(
  filters: StatsFilters = DEFAULT_STATS_FILTERS,
): Promise<PublicStats> {
  const supabase = getSupabaseServer();
  if (!supabase) {
    return {
      ...EMPTY_PUBLIC_STATS,
      filters,
      generatedAt: new Date().toISOString(),
    };
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
    //    Count-distinct via PostgREST requires an RPC; `victories` holds 249
    //    rows today, so in-app dedupe is still whole. It stops being whole at
    //    1,000 — the range CANNOT be raised past that, see POSTGREST_MAX_ROWS.
    //    The explicit ORDER makes truncation deterministic: without it
    //    PostgREST may return ANY 1,000 rows, so the "distinct" count would
    //    drift between refreshes with no way to tell. Newest-first keeps the
    //    recent window whole and drops only the old tail, which is why this
    //    lifetime figure degrades into a lower bound rather than into a lie.
    supabase
      .from("victories")
      .select("player")
      .order("minted_at", { ascending: false })
      .range(0, RANGE_TO) as unknown as Promise<
      DataResult<{ player: string }>
    >,
    // 4. Difficulty distribution — same defensive range + order so the tally
    //    matches `totalVictories` instead of silently truncating.
    supabase
      .from("victories")
      .select("difficulty")
      .order("minted_at", { ascending: false })
      .range(0, RANGE_TO) as unknown as Promise<
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
      .order("created_at", { ascending: false })
      .range(0, RANGE_TO) as unknown as Promise<
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
      .order("created_at", { ascending: false })
      .range(0, RANGE_TO) as unknown as Promise<
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
      .order("minted_at", { ascending: false })
      .range(0, RANGE_TO) as unknown as Promise<
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
  // NOTE: the activity trend is assembled further down, after the
  // new-vs-returning read. Query ORDER is load-bearing for the tests, which
  // sequence `from()` fixtures positionally — new reads append at the end so
  // the existing indices never shift.

  // §8 on-chain block. Computed as its own statement (NOT inline in the
  // return literal — that tips TS over "type instantiation excessively
  // deep" given the 14-element allSettled above). Run after the main
  // reads; the page is cached hourly so the sequential cost is moot. It
  // owns its own Promise.allSettled and never rejects — worst case the
  // block is all-null em-dashes.
  const onchain: OnchainStats = await fetchOnchainStats(
    supabase as unknown as StatsDb,
  ).catch(() => EMPTY_ONCHAIN_STATS);

  // B2.1 challenge funnel — separate await (outside the 13-element allSettled
  // above) to avoid TS "type instantiation excessively deep" on the tuple.
  const challengeFunnel: ChallengeFunnel | null = await (supabase
    .from("analytics_events")
    .select("event, props")
    .in("event", [...CHALLENGE_EVENTS])
    .gte("created_at", since30d)
    .order("created_at", { ascending: false })
    .range(0, RANGE_TO) as unknown as Promise<{
    data: Array<{ event: string; props: unknown }> | null;
    error: unknown;
  }>).then(extractChallengeFunnel, () => null);

  // Observability blocks (activation / top countries / retention). These are
  // the ONLY blocks the surface/container filters touch — headline platform
  // stats (mints, welcome packs, sessions, trend) stay global. Two filtered
  // reads: one event scan (feeds all three) + the cohort table. Separate
  // awaits keep the giant allSettled tuple's type instantiation shallow.
  const applyEventFilters = <T>(q: T): T => {
    let out = q as unknown as {
      eq: (col: string, val: string) => unknown;
    };
    if (filters.surface !== "all") out = out.eq("surface", filters.surface) as typeof out;
    if (filters.container !== "all")
      out = out.eq("container", filters.container) as typeof out;
    return out as unknown as T;
  };

  const filteredEvents30d = await (applyEventFilters(
    supabase
      .from("analytics_events")
      .select("event, session_id, created_at, country, account_ref")
      .gte("created_at", since30d)
      .order("created_at", { ascending: false })
      .range(0, RANGE_TO),
  ) as unknown as Promise<{
    data: Array<{
      event: string;
      session_id: string;
      created_at: string;
      country: string | null;
      account_ref: string | null;
    }> | null;
    error: unknown;
  }>).then(
    (res) => (res.error || !Array.isArray(res.data) ? null : res.data),
    () => null,
  );

  const cohortRows = await (((): unknown => {
    let q = supabase
      .from("session_first_seen")
      .select("session_id, first_seen")
      .gte("first_seen", since30d)
      .order("first_seen", { ascending: false })
      .range(0, RANGE_TO) as unknown as {
      eq: (col: string, val: string) => unknown;
    };
    if (filters.surface !== "all") q = q.eq("first_surface", filters.surface) as typeof q;
    if (filters.container !== "all")
      q = q.eq("first_container", filters.container) as typeof q;
    return q;
  })() as Promise<{
    data: Array<{ session_id: string; first_seen: string }> | null;
    error: unknown;
  }>).then(
    (res) => (res.error || !Array.isArray(res.data) ? null : res.data),
    () => null,
  );

  // Access funnel — its own narrow read rather than a slice of
  // `filteredEvents30d`. The door is the highest-value signal on the page and
  // must not compete for the 10k row budget with every incidental event; an
  // `.in(...)` read keeps it whole long after the broad scan starts truncating.
  const accessRows = await (applyEventFilters(
    supabase
      .from("analytics_events")
      .select("event, session_id")
      .in("event", [...ALL_ACCESS_ALIASES])
      .gte("created_at", since30d)
      .order("created_at", { ascending: false })
      .range(0, RANGE_TO),
  ) as unknown as Promise<{
    data: Array<{ event: string; session_id: string }> | null;
    error: unknown;
  }>).then(
    (res) => (res.error || !Array.isArray(res.data) ? null : res.data),
    () => null,
  );

  const accessFunnel: AccessFunnel | null = accessRows
    ? computeAccessFunnel(accessRows)
    : null;

  // New-vs-returning split for the trend. GLOBAL (unfiltered) because the
  // trend is a headline series — the surface/container filters only touch the
  // observability blocks. Its own await, outside the allSettled tuple: a 15th
  // element tips TS over "type instantiation excessively deep". A failure here
  // degrades to "everything reads as returning" rather than blanking the
  // chart, so the total series survives a partial outage.
  const trendFirstSeenRows = await (supabase
    .from("session_first_seen")
    .select("session_id, first_seen")
    .gte("first_seen", since30d)
    .order("first_seen", { ascending: false })
    .range(0, RANGE_TO) as unknown as Promise<{
    data: Array<{ session_id: string; first_seen: string }> | null;
    error: unknown;
  }>).then(
    (res) => (res.error || !Array.isArray(res.data) ? null : res.data),
    () => null,
  );

  // NOTE: the trend is assembled AFTER the integrity ledger below — it is a
  // windowed series and a capped read would draw 29 empty days beside one tall
  // bar, which reads as a collapse in traffic rather than as a capped read.

  // Account denominator — THREE EXACT COUNTS, not a row scan.
  //
  // `count: "exact", head: true` is answered in a `Content-Range` header with
  // ZERO rows transferred, so these three are immune to the 1,000-row ceiling
  // that capped everything above. Deriving them from `accountRows.length` is
  // what once published "1,000 accounts ever seen · 1,000 arrived today · 1,000
  // this week" — three fields with the same value because they were the same
  // capped list counted three times.
  const accountCountResults = await Promise.allSettled([
    supabase
      .from("account_first_seen")
      .select("*", { count: "exact", head: true }) as unknown as Promise<CountResult>,
    supabase
      .from("account_first_seen")
      .select("*", { count: "exact", head: true })
      .gte("first_seen", startOfUtcDay(now)) as unknown as Promise<CountResult>,
    supabase
      .from("account_first_seen")
      .select("*", { count: "exact", head: true })
      .gte("first_seen", since7d) as unknown as Promise<CountResult>,
  ]);
  const knownAccounts = extractCount(
    accountCountResults[0] as PromiseSettledResult<CountResult>,
  );
  const newAccountsToday = extractCount(
    accountCountResults[1] as PromiseSettledResult<CountResult>,
  );
  const newAccounts7d = extractCount(
    accountCountResults[2] as PromiseSettledResult<CountResult>,
  );

  // The row scan survives only to build the active/dormant/inactive partition,
  // which needs each account's identity and not just how many there are. Read
  // WITHOUT a time bound on purpose: "inactive" is the absence of activity, so
  // it can only be counted against every account that ever existed.
  const accountRows = await (supabase
    .from("account_first_seen")
    .select("account_ref, first_seen")
    .order("first_seen", { ascending: false })
    .range(0, RANGE_TO) as unknown as Promise<{
    data: Array<{ account_ref: string; first_seen: string }> | null;
    error: unknown;
  }>).then(
    (res) => (res.error || !Array.isArray(res.data) ? null : res.data),
    () => null,
  );

  // ── Integrity ledger ──────────────────────────────────────────────────────
  // Computed BEFORE the derivations, because every windowed metric below is
  // gated on it. Named per read so the page can say WHICH numbers went dark
  // instead of a blanket disclaimer nobody can act on.
  const truncated: string[] = [];
  const noteIfTruncated = (label: string, rows: unknown): boolean => {
    const capped = hitCeiling(rows);
    if (capped) truncated.push(label);
    return capped;
  };
  const mintersCapped = noteIfTruncated("unique minters (lifetime)", extractRows(uniqueMintersRes as PromiseSettledResult<DataResult<{ player: string }>>));
  const difficultyCapped = noteIfTruncated("difficulty split (lifetime)", extractRows(difficultyRes as PromiseSettledResult<DataResult<{ difficulty: number }>>));
  const sessions7dCapped = noteIfTruncated("app sessions (7d)", extractRows(sessions7dRes as PromiseSettledResult<DataResult<{ session_id: string }>>));
  const sessions30dCapped = noteIfTruncated("app sessions + trend (30d)", sessionTrendRows);
  const mintTrendCapped = noteIfTruncated("progress saves trend (30d)", mintTrendRows);
  const firstSeenCapped = noteIfTruncated("new vs returning (30d)", trendFirstSeenRows);
  const events30dCapped = noteIfTruncated("activation / countries / habit (30d)", filteredEvents30d);
  const cohortCapped = noteIfTruncated("retention cohorts (30d)", cohortRows);
  const accessCapped = noteIfTruncated("access funnel (30d)", accessRows);
  const accountsCapped = noteIfTruncated("account partition (lifetime)", accountRows);

  // ── Gating ────────────────────────────────────────────────────────────────
  // A capped read is fatal for a WINDOWED metric and merely lossy for a
  // LIFETIME one. Every ranged read is ordered newest-first, so a cap silently
  // narrows the window — "last 30 days" became "last 15 minutes" and the page
  // published 46 sessions against a real 3,928. A lifetime figure degrades into
  // an honest lower bound; a windowed one degrades into a lie with no tell.
  //
  // So: windowed metrics go `null`, which the view already renders as an
  // em-dash. NEVER zero — a zero asserts "nobody did this", the opposite of
  // "we could not measure this".
  const wholeEvents30d = events30dCapped ? null : filteredEvents30d;
  const wholeCohorts = cohortCapped ? null : cohortRows;

  const accountLifecycle: AccountLifecycle | null =
    knownAccounts === null || newAccountsToday === null || newAccounts7d === null
      ? null
      : {
          known: knownAccounts,
          newToday: newAccountsToday,
          new7d: newAccounts7d,
          // The partition needs BOTH sides whole: the account list for the
          // denominator and the event scan for the activity. Either one capped
          // and the three buckets are unmeasurable — not zero.
          ...(accountRows && wholeEvents30d && !accountsCapped
            ? pickAccountActivity(
                computeAccountLifecycle(accountRows, wholeEvents30d),
              )
            : UNMEASURED_ACCOUNT_ACTIVITY),
        };

  const habitDepth: HabitDepth | null = wholeEvents30d
    ? computeHabitDepth(wholeEvents30d)
    : null;

  const activation: ActivationFunnel | null = wholeEvents30d
    ? computeActivation(
        wholeEvents30d.filter((r) =>
          (ALL_FUNNEL_ALIASES as readonly string[]).includes(r.event),
        ),
      )
    : null;
  const dailyFocusFunnel: DailyFocusFunnel | null = wholeEvents30d
    ? computeDailyFocusFunnel(
        wholeEvents30d.filter((r) =>
          (ALL_DAILY_FOCUS_ALIASES as readonly string[]).includes(r.event),
        ),
      )
    : null;
  const appOpens30d =
    activation?.find((s) => s.step === "app_opened")?.sessions ?? null;
  const topCountries: CountryCount[] = wholeEvents30d
    ? computeTopCountries(wholeEvents30d)
    : [];
  const retention: Retention | null =
    wholeCohorts && wholeEvents30d
      ? computeRetention(wholeCohorts, wholeEvents30d)
      : null;

  // The access funnel is its own narrow read, so it survives long after the
  // broad scan starts truncating — but when IT is capped, the door counts are
  // a 15-minute slice labelled 30 days, same as the rest.
  const gatedAccessFunnel: AccessFunnel | null = accessCapped
    ? null
    : accessFunnel;

  // The trend is four panels over ONE bucket array, so it is all-or-nothing:
  // there is no way to blank one series without printing zeros for it, and a
  // 30-bar chart of zeros reads as "traffic collapsed", not as "not measured".
  //
  // Both reads must be whole. A capped session read draws 29 empty days beside
  // one tall bar; a capped `session_first_seen` read makes every install look
  // brand new, which is how the page came to show "New installs 46 ·
  // Returning 0". Either one capped and the section is hidden — the exact
  // "Progress Saves (30d)" card above already carries the mint total.
  const trendReadable = !sessions30dCapped && !firstSeenCapped && !mintTrendCapped;
  const activityTrend30d =
    !trendReadable || (sessionTrendRows == null && mintTrendRows == null)
      ? []
      : computeActivityTrend(sessionTrendRows, mintTrendRows, trendFirstSeenRows);

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
    // Both go null the moment their read is capped. A `Set` built over the
    // newest 1,000 rows is a 15-minute headcount, and printing it under a "7d"
    // or "30d" label is the single worst number this page has ever shipped.
    activeSessions7d: sessions7dCapped
      ? null
      : extractDistinctCount(
          sessions7dRes as PromiseSettledResult<
            DataResult<{ session_id: string }>
          >,
          "session_id",
        ),
    activeSessions30d: sessions30dCapped
      ? null
      : extractDistinctCount(
          sessions30dRes as PromiseSettledResult<
            DataResult<{ session_id: string }>
          >,
          "session_id",
        ),
    coachAnalysesLifetime: extractCount(
      coachLifetimeRes as PromiseSettledResult<CountResult>,
    ),
    coachAnalyses7d: extractCount(coach7dRes as PromiseSettledResult<CountResult>),
    topMinters: aggregateTopMinters(
      extractRows(hallOfFameRes as PromiseSettledResult<DataResult<VictoryRow>>),
    ),
    leaderboardTop10:
      leaderboardRes.status === "fulfilled"
        ? leaderboardRes.value.slice(0, 10).map((r) => {
            const wallet = r.player.toLowerCase();
            return {
              rank: r.rank,
              rowId: deriveRowId(wallet),
              variant: deriveAvatarVariant(wallet),
              totalScore: r.total_score,
              isVerified: r.is_verified,
              hasOnchain: r.has_onchain ?? false,
            };
          })
        : [],
    activityTrend30d,
    generatedAt,
    onchain,
    challengeFunnel,
    filters,
    appOpens30d,
    activation,
    dailyFocusFunnel,
    topCountries,
    retention,
    accessFunnel: gatedAccessFunnel,
    accountLifecycle,
    habitDepth,
    dataIntegrity: { truncated, rowCeiling: ROW_CEILING },
  };
}
