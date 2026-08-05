/**
 * TEMPORARY diagnostic counters for the production cache incident.
 *
 * The question timings cannot answer: on a SECOND request, does anything
 * underneath the snapshot actually run? `x-vercel-cache` describes the ROUTE
 * response, not `unstable_cache`, and a warm instance looks exactly like a
 * working cache from outside. So we count.
 *
 * Every field is an integer or an opaque id. Nothing here records a credential,
 * a URL, a wallet, an `account_ref`, a `session_id`, or any metric value.
 *
 * Gated on `STATS_DEBUG === "1"`. **Deleted once the incident is closed.**
 */

export const STATS_DEBUG = process.env.STATS_DEBUG === "1";

export type StatsCounters = {
  /** Renders of `/stats`. */
  renders: number;
  /** REAL executions of the snapshot's `unstable_cache` callback. A cached
   *  value returned without running the callback must NOT move this. */
  snapshotReads: number;
  rpcCalls: number;
  onchainReads: number;
  censusReads: number;
};

const counters: StatsCounters = {
  renders: 0,
  snapshotReads: 0,
  rpcCalls: 0,
  onchainReads: 0,
  censusReads: 0,
};

/**
 * Minted ONCE per module instance — the load-bearing signal.
 *
 * Two requests reporting different ids ran on different Fluid instances, so a
 * cold in-process memo would explain a miss WITHOUT the cache being broken.
 * Same id plus a second `snapshotReads` is the opposite: reuse really is not
 * happening. Without this, the two are indistinguishable.
 */
export const INSTANCE_ID = Math.random().toString(36).slice(2, 10);

/** The snapshot's own clock, as returned by the cached value — NOT `Date.now()`
 *  at diagnostic time, which would always look fresh and prove nothing. */
let lastGeneratedAt: string | null = null;

export function bump(key: keyof StatsCounters): void {
  if (STATS_DEBUG) counters[key] += 1;
}

export function noteGeneratedAt(value: string): void {
  if (STATS_DEBUG) lastGeneratedAt = value;
}

export function readCounters(): StatsCounters & {
  instanceId: string;
  lastGeneratedAt: string | null;
} {
  return { ...counters, instanceId: INSTANCE_ID, lastGeneratedAt };
}
