import type { SurfaceBreakdown } from "./aggregator";
import type { StatsSnapshot } from "./snapshot";
import type { PlayersCensus } from "./players-census";

/** One durable, intentionally unfiltered public-stats snapshot. */
export const STATS_SNAPSHOT_KEY = "stats:public:all-all:v1";
/** Short lease: a failed function cannot leave the refresh permanently locked. */
export const STATS_REFRESH_LOCK_KEY = "stats:public:refresh-lock:v1";
export const STATS_REFRESH_LOCK_TTL_SECONDS = 120;
/** Successful refreshes are deliberately limited to the cron cadence. */
export const STATS_REFRESH_COOLDOWN_KEY = "stats:public:refresh-cooldown:v1";
export const STATS_REFRESH_COOLDOWN_SECONDS = 6 * 60 * 60;

export type PersistedStatsSnapshot = StatsSnapshot & {
  census: PlayersCensus;
  version: 1;
  refreshedAt: string;
};

export type StatsRedis = {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, options?: { nx?: boolean; ex?: number }): Promise<unknown>;
  eval(script: string, keys: string[], args: string[]): Promise<unknown>;
};

export type RefreshResult =
  | { status: "refreshed"; snapshot: PersistedStatsSnapshot }
  | { status: "locked" }
  | { status: "cooldown" }
  | { status: "incomplete" };

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function isCompleteSnapshot(snapshot: unknown): snapshot is PersistedStatsSnapshot {
  const candidate = record(snapshot);
  if (!candidate) return false;
  const stats = record(candidate.stats);
  const filters = record(stats?.filters);
  const integrity = record(stats?.dataIntegrity);
  const onchain = record(stats?.onchain);
  const methodTx = record(onchain?.methodTx);
  const breakdown = record(candidate.breakdown);
  const census = record(candidate.census);
  return (
    candidate.version === 1 &&
    typeof candidate.refreshedAt === "string" &&
    filters?.surface === "all" &&
    filters.container === "all" &&
    typeof stats?.generatedAt === "string" &&
    Array.isArray(integrity?.failedRpcs) &&
    integrity.failedRpcs.length === 0 &&
    Array.isArray(stats?.topCountries) &&
    Array.isArray(stats?.activityTrend30d) &&
    methodTx !== null &&
    breakdown?.learn !== null &&
    breakdown?.learn !== undefined &&
    breakdown?.play !== null &&
    breakdown?.play !== undefined &&
    breakdown?.total !== null &&
    breakdown?.total !== undefined &&
    census?.rowsRead === "ok" &&
    Array.isArray(census.rows) &&
    typeof census.total === "number"
  );
}

export async function readPersistedStatsSnapshot(
  redis: Pick<StatsRedis, "get">,
): Promise<PersistedStatsSnapshot | null> {
  const snapshot = await redis.get<unknown>(STATS_SNAPSHOT_KEY);
  return snapshot && isCompleteSnapshot(snapshot) ? snapshot : null;
}

function lockToken(): string {
  return `${Date.now()}:${crypto.randomUUID()}`;
}

const RELEASE_IF_OWNED =
  "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

/**
 * Builds off-key and writes only a complete replacement. A failed/partial run
 * leaves the previous durable snapshot untouched.
 */
export async function refreshPersistedStatsSnapshot(input: {
  redis: StatsRedis;
  build: () => Promise<PersistedStatsSnapshot>;
}): Promise<RefreshResult> {
  const token = lockToken();
  const acquired = await input.redis.set(STATS_REFRESH_LOCK_KEY, token, {
    nx: true,
    ex: STATS_REFRESH_LOCK_TTL_SECONDS,
  });
  if (!acquired) return { status: "locked" };

  try {
    if (await input.redis.get(STATS_REFRESH_COOLDOWN_KEY)) {
      return { status: "cooldown" };
    }
    const candidate = await input.build();
    if (!isCompleteSnapshot(candidate)) return { status: "incomplete" };
    await input.redis.set(STATS_SNAPSHOT_KEY, candidate);
    await input.redis.set(STATS_REFRESH_COOLDOWN_KEY, candidate.refreshedAt, {
      ex: STATS_REFRESH_COOLDOWN_SECONDS,
    });
    return { status: "refreshed", snapshot: candidate };
  } finally {
    await input.redis.eval(RELEASE_IF_OWNED, [STATS_REFRESH_LOCK_KEY], [token]).catch(() => {});
  }
}

export function asPersistedSnapshot(input: {
  stats: StatsSnapshot["stats"];
  breakdown: SurfaceBreakdown;
  census: PlayersCensus;
  now?: Date;
}): PersistedStatsSnapshot {
  return {
    version: 1,
    refreshedAt: (input.now ?? new Date()).toISOString(),
    stats: input.stats,
    breakdown: input.breakdown,
    census: input.census,
  };
}
