/**
 * The `/stats` contract, RPC-shaped.
 *
 * Port of `PublicStats` from `apps/web/src/lib/stats/public-aggregator.ts`, with
 * every field that used to be derived in JS now coming back from one of the
 * eight `stats_*` functions. The shape is deliberately close to the old one so
 * Phase D can port the view with a rename and not a rewrite.
 *
 * ⚠️ `number | null` is load-bearing everywhere. `null` means **"we could not
 * measure this"** and renders as an em-dash. It is emphatically NOT zero: a
 * zero asserts "nobody did this", which is the opposite claim, and publishing
 * one off a failed read is the exact defect the audit was opened for. Arrays
 * default to `[]`.
 */

import type { StatsFilters } from "./filters";
import { DEFAULT_STATS_FILTERS } from "./filters";
import { EMPTY_ONCHAIN_STATS, type OnchainStats } from "./onchain";

/** Install/session headline counts — `stats_install_counts`. */
export type InstallCounts = {
  sessions7d: number;
  sessions30d: number;
  /** ⚠️ Counts ROWS, not sessions, and therefore inherits the 8.6 % of exact
   *  duplicate rows in `analytics_events`. The migration declares it
   *  approximate in its `comment on function`; any surface that prints it must
   *  say so too. */
  appOpensRows30d: number;
  appOpenSessions30d: number;
};

/** One step of the activation funnel — `stats_activation_funnel`.
 *  Non-increasing BY ALGEBRA: the SQL uses a nested prefix, so step *k*
 *  requires having emitted steps 1..*k*. A drop is always a real drop. */
export type ActivationStep = { step: string; sessions: number };
export type ActivationFunnel = ActivationStep[];

/** Door-to-value funnel — `stats_access_funnel`. */
export type AccessStepCount = { step: string; sessions: number };
export type AccessFunnel = {
  steps: AccessStepCount[];
  /** Distinct gate sessions that hit at least one login error. Sits BESIDE the
   *  funnel: a session can fail and then succeed, so this is friction, not
   *  loss, and is never subtracted from any step. */
  failedSessions: number;
};

/** `stats_top_countries` — top 8, ordered `sessions desc, country asc` (a
 *  TOTAL order, so the ranking is reproducible). Null/empty country excluded. */
export type CountryCount = { country: string; sessions: number };

export type RetentionBucket = { returned: number; cohort: number };
/** `stats_retention`. `d1`/`d7` are exact days; `week3` is the **15–21 day
 *  window**, not day 21. All three rows always come back — a `cohort: 0` means
 *  "nobody was eligible yet", which the UI must NOT render as "nobody
 *  returned". */
export type Retention = {
  d1: RetentionBucket;
  d7: RetentionBucket;
  week3: RetentionBucket;
};

/** `stats_account_lifecycle`. PEOPLE (keyed pseudonyms), not installs.
 *  `active7d + dormant + inactive === known` by construction, over **rolling
 *  windows** and not calendar bands. `resurrected7d ⊆ active7d` and is NOT part
 *  of the partition. */
export type AccountLifecycle = {
  known: number;
  /** Calendar day UTC — the label says "today", so the number must too. */
  newToday: number;
  /** Rolling 7-day window, NOT "this week". */
  new7d: number;
  active7d: number;
  dormant: number;
  inactive: number;
  resurrected7d: number;
};

export type HabitBucket = { minDays: number; installs: number };
/** `stats_habit_depth`. Buckets are CUMULATIVE, so `installs` is
 *  non-increasing across 1/3/7/14/21. */
export type HabitDepth = {
  buckets: HabitBucket[];
  cohort: number;
  medianActiveDays: number;
};

/**
 * One day of `stats_activity_trend`. Exactly 30 rows, dense (zeros included),
 * oldest first, and `newInstalls + returningInstalls === sessions` per row.
 *
 * ⚠️ **`mints` is gone on purpose.** The web version carried a mint series
 * derived from a `victories` row scan; the RPC does not return one, and adding
 * a ranged read to recover it would reintroduce exactly the truncation this
 * phase removes. The mint total already lives in its own card.
 */
export type DailyBucket = {
  date: string;
  sessions: number;
  newInstalls: number;
  returningInstalls: number;
};

/** Which RPCs failed. Replaces the old `dataIntegrity.truncated` ledger: there
 *  is no row ceiling to hit any more, so the only way a number goes missing is
 *  a call that errored. Named per RPC so the page can say WHICH number went
 *  dark instead of a blanket disclaimer nobody can act on. */
export type DataIntegrity = {
  failedRpcs: string[];
};

export type PublicStats = {
  /** Echo of the applied filters (drives the UI controls + the "filtered by"
   *  label). */
  filters: StatsFilters;
  /** ISO timestamp at aggregation time — the "as of" label, so a stale
   *  snapshot is identifiable. */
  generatedAt: string;

  installs: InstallCounts | null;
  activation: ActivationFunnel | null;
  /** Convenience echo of `activation`'s first step. */
  appOpens30d: number | null;
  accessFunnel: AccessFunnel | null;
  topCountries: CountryCount[];
  retention: Retention | null;
  accountLifecycle: AccountLifecycle | null;
  habitDepth: HabitDepth | null;
  activityTrend30d: DailyBucket[];

  /** §8 on-chain block. Ported unchanged from apps/web — these numbers are
   *  correct today and this phase must not move them. */
  onchain: OnchainStats;

  dataIntegrity: DataIntegrity;
};

export const EMPTY_PUBLIC_STATS: PublicStats = {
  filters: DEFAULT_STATS_FILTERS,
  generatedAt: new Date(0).toISOString(),
  installs: null,
  activation: null,
  appOpens30d: null,
  accessFunnel: null,
  topCountries: [],
  retention: null,
  accountLifecycle: null,
  habitDepth: null,
  activityTrend30d: [],
  onchain: EMPTY_ONCHAIN_STATS,
  dataIntegrity: { failedRpcs: [] },
};
