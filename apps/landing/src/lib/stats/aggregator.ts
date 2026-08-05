import { getSupabaseServer } from "@/lib/supabase/server";

import { DEFAULT_STATS_FILTERS, toRpcArg, type StatsFilters } from "./filters";
import {
  EMPTY_ONCHAIN_STATS,
  fetchOnchainStats,
  type OnchainStats,
  type StatsDb,
} from "./onchain";
import {
  EMPTY_PUBLIC_STATS,
  type AccessFunnel,
  type AccountLifecycle,
  type ActivationFunnel,
  type CountryCount,
  type DailyBucket,
  type HabitDepth,
  type InstallCounts,
  type PublicStats,
  type Retention,
} from "./types";

/**
 * The public `/stats` aggregator, fed by the eight `stats_*` RPCs.
 *
 * ⛔ **There is no `new Set()` over telemetry rows here, and there must never
 * be one again.** The page this replaces counted distinct sessions in JS over
 * rows PostgREST had already capped at 1,000, so "last 30 days" silently became
 * "last 15 minutes" and it published 46 sessions against a real 3,928. Every
 * count below is computed in PostgreSQL. There is a source guard that fails the
 * build if a ranged read or a `Set` reappears over the three telemetry tables —
 * see `__tests__/aggregator-source-guard.test.ts`.
 *
 * Each RPC runs in isolation: a failure nulls **its own** field and names
 * itself in `dataIntegrity.failedRpcs`, so the rest of the page survives and
 * the reader can tell which number went dark. `null` is "not measured" and
 * renders as an em-dash — NEVER zero.
 *
 * Contracts, invariants and the reference SQL:
 * `docs/audits/2026-08-04-public-stats-accuracy-audit.md` §13 and §22.
 */

/** The eight, in the order they are dispatched. Exported so the guard test can
 *  assert the aggregator calls all of them and nothing else. */
export const STATS_RPCS = [
  "stats_install_counts",
  "stats_activation_funnel",
  "stats_access_funnel",
  "stats_top_countries",
  "stats_retention",
  "stats_account_lifecycle",
  "stats_habit_depth",
  "stats_activity_trend",
] as const;

export type StatsRpcName = (typeof STATS_RPCS)[number];

type RpcClient = {
  rpc: (
    name: string,
    args: Record<string, string | null>,
  ) => PromiseLike<{ data: unknown; error: unknown }>;
};

/** Rows from one RPC, or `null` if the call failed. Never throws: a rejected
 *  promise and an error payload collapse to the same `null`. */
async function callRpc(
  client: RpcClient,
  name: StatsRpcName,
  filters: StatsFilters,
): Promise<Record<string, unknown>[] | null> {
  try {
    const { data, error } = await client.rpc(name, {
      // ⛔ `"all"` never reaches SQL — null is how the functions spell
      // "no filter". A literal 'all' would match zero rows.
      p_surface: toRpcArg(filters.surface),
      p_container: toRpcArg(filters.container),
    });
    if (error || !Array.isArray(data)) return null;
    return data as Record<string, unknown>[];
  } catch {
    return null;
  }
}

const num = (v: unknown): number => (typeof v === "number" ? v : Number(v ?? 0));
const str = (v: unknown): string => (typeof v === "string" ? v : String(v ?? ""));

/** Scalar-returning RPCs come back as a one-row table. */
function firstRow(
  rows: Record<string, unknown>[] | null,
): Record<string, unknown> | null {
  return rows && rows.length > 0 ? rows[0] : null;
}

function toInstallCounts(rows: Record<string, unknown>[] | null): InstallCounts | null {
  const r = firstRow(rows);
  if (!r) return null;
  return {
    sessions7d: num(r.sessions_7d),
    sessions30d: num(r.sessions_30d),
    appOpensRows30d: num(r.app_opens_rows_30d),
    appOpenSessions30d: num(r.app_open_sessions_30d),
  };
}

function toActivation(rows: Record<string, unknown>[] | null): ActivationFunnel | null {
  if (!rows) return null;
  return rows.map((r) => ({ step: str(r.step), sessions: num(r.sessions) }));
}

/** `failed_sessions` is a funnel-level scalar the SQL repeats on all five rows;
 *  reading it off the first is correct, not a shortcut. */
function toAccessFunnel(rows: Record<string, unknown>[] | null): AccessFunnel | null {
  if (!rows) return null;
  return {
    steps: rows.map((r) => ({ step: str(r.step), sessions: num(r.sessions) })),
    failedSessions: num(firstRow(rows)?.failed_sessions),
  };
}

function toTopCountries(rows: Record<string, unknown>[] | null): CountryCount[] {
  if (!rows) return [];
  // NOT re-sorted: the order is a TOTAL order fixed in SQL
  // (`sessions desc, country asc`). A second sort here could disagree with it.
  return rows.map((r) => ({ country: str(r.country), sessions: num(r.sessions) }));
}

/** The three buckets always come back — `LEFT JOIN` in the SQL guarantees a row
 *  even for an empty cohort. A missing bucket therefore means a broken
 *  contract, not an empty one, so it nulls the whole block. */
function toRetention(rows: Record<string, unknown>[] | null): Retention | null {
  if (!rows) return null;
  const byBucket = new Map(rows.map((r) => [str(r.bucket), r]));
  const pick = (key: string) => {
    const r = byBucket.get(key);
    return r ? { returned: num(r.returned), cohort: num(r.cohort) } : null;
  };
  const d1 = pick("d1");
  const d7 = pick("d7");
  const week3 = pick("week3");
  if (!d1 || !d7 || !week3) return null;
  return { d1, d7, week3 };
}

function toAccountLifecycle(
  rows: Record<string, unknown>[] | null,
): AccountLifecycle | null {
  const r = firstRow(rows);
  if (!r) return null;
  return {
    known: num(r.known),
    newToday: num(r.new_today),
    new7d: num(r.new_7d),
    active7d: num(r.active_7d),
    dormant: num(r.dormant),
    inactive: num(r.inactive),
    resurrected7d: num(r.resurrected_7d),
  };
}

/** `cohort` and `median_active_days` are repeated on every bucket row by the
 *  SQL; both are read off the first. */
function toHabitDepth(rows: Record<string, unknown>[] | null): HabitDepth | null {
  if (!rows) return null;
  const head = firstRow(rows);
  return {
    buckets: rows.map((r) => ({
      minDays: num(r.min_days),
      installs: num(r.installs),
    })),
    cohort: num(head?.cohort),
    medianActiveDays: num(head?.median_active_days),
  };
}

/** Exactly 30 dense rows, oldest first, straight from `generate_series`. No
 *  bucket-filling here: the density is the SQL's guarantee, and re-deriving it
 *  in JS would hide a broken one. */
function toActivityTrend(rows: Record<string, unknown>[] | null): DailyBucket[] {
  if (!rows) return [];
  return rows.map((r) => ({
    date: str(r.day).slice(0, 10),
    sessions: num(r.sessions),
    newInstalls: num(r.new_installs),
    returningInstalls: num(r.returning_installs),
  }));
}

/**
 * Read every block for the given filters.
 *
 * Returns `EMPTY_PUBLIC_STATS` (all em-dashes) when Supabase is unconfigured,
 * and **never throws** — the page must render even with the credentials gone.
 */
export async function getPublicStats(
  filters: StatsFilters = DEFAULT_STATS_FILTERS,
): Promise<PublicStats> {
  const generatedAt = new Date().toISOString();
  const supabase = getSupabaseServer();

  if (!supabase) {
    return { ...EMPTY_PUBLIC_STATS, filters, generatedAt };
  }

  const client = supabase as unknown as RpcClient;

  // All eight in parallel: they are independent reads of the same snapshot and
  // serialising them would multiply the page's latency by eight for nothing.
  const [
    installsRows,
    activationRows,
    accessRows,
    countriesRows,
    retentionRows,
    lifecycleRows,
    habitRows,
    trendRows,
  ] = await Promise.all(
    STATS_RPCS.map((name) => callRpc(client, name, filters)),
  );

  // The on-chain block owns its own queries and its own `allSettled`; it never
  // rejects, so worst case it is all-null em-dashes. Awaited separately because
  // it is not an RPC and does not take the filters — those numbers are global.
  const onchain: OnchainStats = await fetchOnchainStats(
    supabase as unknown as StatsDb,
  ).catch(() => EMPTY_ONCHAIN_STATS);

  const failedRpcs = STATS_RPCS.filter(
    (_, i) =>
      [
        installsRows,
        activationRows,
        accessRows,
        countriesRows,
        retentionRows,
        lifecycleRows,
        habitRows,
        trendRows,
      ][i] === null,
  );

  const activation = toActivation(activationRows);

  return {
    filters,
    generatedAt,
    installs: toInstallCounts(installsRows),
    activation,
    appOpens30d:
      activation?.find((s) => s.step === "app_opened")?.sessions ?? null,
    accessFunnel: toAccessFunnel(accessRows),
    topCountries: toTopCountries(countriesRows),
    retention: toRetention(retentionRows),
    accountLifecycle: toAccountLifecycle(lifecycleRows),
    habitDepth: toHabitDepth(habitRows),
    activityTrend30d: toActivityTrend(trendRows),
    onchain,
    dataIntegrity: { failedRpcs: [...failedRpcs] },
  };
}
