import { describe, expect, it, vi } from "vitest";

import {
  STATS_REFRESH_LOCK_KEY,
  STATS_REFRESH_LOCK_TTL_SECONDS,
  STATS_RPC_PHASE_BUDGET_MS,
  STATS_REFRESH_COOLDOWN_KEY,
  STATS_REFRESH_COOLDOWN_SECONDS,
  STATS_SNAPSHOT_KEY,
  asPersistedSnapshot,
  readPersistedStatsSnapshot,
  refreshPersistedStatsSnapshot,
  withinRefreshPhase,
  type PersistedStatsSnapshot,
  type StatsRedis,
} from "../persisted-snapshot";
import { EMPTY_PUBLIC_STATS } from "../types";

function snapshot(stamp = "2026-09-15T00:00:00.000Z"): PersistedStatsSnapshot {
  return asPersistedSnapshot({
    stats: {
      ...EMPTY_PUBLIC_STATS,
      generatedAt: stamp,
      installs: { sessions7d: 0, sessions30d: 0, appOpensRows30d: 0, appOpenSessions30d: 0 },
      activation: [],
      accessFunnel: { steps: [], failedSessions: 0 },
      retention: { d1: { returned: 0, cohort: 0 }, d7: { returned: 0, cohort: 0 }, week3: { returned: 0, cohort: 0 } },
      accountLifecycle: { known: 0, newToday: 0, new7d: 0, active7d: 0, dormant: 0, inactive: 0, resurrected7d: 0 },
      habitDepth: { buckets: [], cohort: 0, medianActiveDays: 0 },
      dataIntegrity: { failedRpcs: [] },
    },
    breakdown: { learn: {}, play: {}, total: {} } as never,
    census: { rows: [], total: 1, rowsRead: "ok", asOf: stamp },
    now: new Date(stamp),
  });
}

function fakeRedis(): StatsRedis & { values: Map<string, unknown>; now: number } {
  const values = new Map<string, unknown>();
  const expiries = new Map<string, number>();
  const redis = {
    values,
    now: 0,
    async get<T>(key: string) {
      if ((expiries.get(key) ?? Infinity) <= redis.now) values.delete(key);
      return (values.get(key) as T | undefined) ?? null;
    },
    async set(key: string, value: unknown, options?: { nx?: boolean; ex?: number }) {
      if ((expiries.get(key) ?? Infinity) <= redis.now) values.delete(key);
      if (options?.nx && values.has(key)) return null;
      values.set(key, value);
      if (options?.ex) expiries.set(key, redis.now + options.ex * 1000);
      return "OK";
    },
    async eval(_script: string, keys: string[], args: string[]) {
      if (await redis.get(keys[0]) !== args[0]) return 0;
      if (keys.length === 3) {
        await redis.set(keys[1], JSON.parse(args[1]));
        await redis.set(keys[2], args[2], { ex: Number(args[3]) });
      } else values.delete(keys[0]);
      return 1;
    },
  };
  return redis;
}

describe("durable public stats snapshot", () => {
  it("a public read with a snapshot performs no build", async () => {
    const redis = fakeRedis();
    redis.values.set(STATS_SNAPSHOT_KEY, snapshot());
    await expect(readPersistedStatsSnapshot(redis)).resolves.not.toBeNull();
  });

  it("a missing snapshot is degraded and performs no build", async () => {
    const redis = fakeRedis();
    await expect(readPersistedStatsSnapshot(redis)).resolves.toBeNull();
  });

  it("treats an invalid Redis value as an unavailable snapshot", async () => {
    const redis = fakeRedis();
    redis.values.set(STATS_SNAPSHOT_KEY, {
      version: 1,
      refreshedAt: "2026-09-15T00:00:00.000Z",
      stats: { dataIntegrity: { failedRpcs: [] } },
      breakdown: { learn: {}, play: {}, total: {} },
      census: { rows: [], total: 1, rowsRead: "ok" },
    });
    await expect(readPersistedStatsSnapshot(redis)).resolves.toBeNull();
  });

  it("reads a complete pre-minimum snapshot as fully available", async () => {
    const redis = fakeRedis();
    const legacy = snapshot();
    delete (legacy as Partial<PersistedStatsSnapshot>).availability;
    redis.values.set(STATS_SNAPSHOT_KEY, legacy);
    await expect(readPersistedStatsSnapshot(redis)).resolves.toMatchObject({
      availability: { onchain: "available", census: "available" },
    });
  });

  it("accepts a coherent emergency snapshot with omitted RPC blocks explicitly unavailable", async () => {
    const redis = fakeRedis();
    const emergency = asPersistedSnapshot({
      stats: {
        ...EMPTY_PUBLIC_STATS,
        generatedAt: "2026-09-15T00:00:00.000Z",
        dataIntegrity: { failedRpcs: ["stats_install_counts", "stats_top_countries", "stats_habit_depth"] },
      },
      breakdown: { learn: null, play: null, total: null },
      census: { rows: [], total: null, rowsRead: "unavailable", asOf: new Date(0).toISOString() },
      availability: {
        onchain: "temporarily_unavailable",
        census: "temporarily_unavailable",
        breakdown: "temporarily_unavailable",
        rpcs: {
          stats_install_counts: "temporarily_unavailable",
          stats_activation_funnel: "available",
          stats_access_funnel: "available",
          stats_top_countries: "temporarily_unavailable",
          stats_retention: "available",
          stats_account_lifecycle: "available",
          stats_habit_depth: "temporarily_unavailable",
          stats_activity_trend: "available",
        },
      },
    });
    redis.values.set(STATS_SNAPSHOT_KEY, emergency);
    await expect(readPersistedStatsSnapshot(redis)).resolves.toMatchObject({
      availability: { breakdown: "temporarily_unavailable" },
    });
  });

  it("replaces only a complete successful snapshot", async () => {
    const redis = fakeRedis();
    const old = snapshot("2026-09-15T00:00:00.000Z");
    const fresh = snapshot("2026-09-15T06:00:00.000Z");
    redis.values.set(STATS_SNAPSHOT_KEY, old);
    const result = await refreshPersistedStatsSnapshot({ redis, build: async () => fresh });
    expect(result.status).toBe("refreshed");
    expect(redis.values.get(STATS_SNAPSHOT_KEY)).toEqual(fresh);
  });

  it("preserves the last healthy snapshot on an incomplete refresh", async () => {
    const redis = fakeRedis();
    const old = snapshot();
    redis.values.set(STATS_SNAPSHOT_KEY, old);
    const result = await refreshPersistedStatsSnapshot({
      redis,
      build: async () => ({ ...snapshot(), stats: { dataIntegrity: { failedRpcs: ["stats_habit_depth"] } } } as never),
    });
    expect(result.status).toBe("incomplete");
    expect(redis.values.get(STATS_SNAPSHOT_KEY)).toBe(old);
  });

  it("allows only one regeneration across independent workers sharing Redis", async () => {
    const redis = fakeRedis();
    let builds = 0;
    let release!: () => void;
    const build = async () => {
      builds += 1;
      await new Promise<void>((resolve) => { release = resolve; });
      return snapshot();
    };
    const first = refreshPersistedStatsSnapshot({ redis, build });
    await Promise.resolve();
    vi.resetModules();
    const otherWorker = await import("../persisted-snapshot");
    const second = await otherWorker.refreshPersistedStatsSnapshot({ redis, build });
    expect(second.status).toBe("locked");
    expect(builds).toBe(1);
    release();
    await expect(first).resolves.toMatchObject({ status: "refreshed" });
  });

  it("uses an expiring lock, never a permanent one", async () => {
    const redis = fakeRedis();
    await redis.set(STATS_REFRESH_LOCK_KEY, "dead-worker", { nx: true, ex: STATS_REFRESH_LOCK_TTL_SECONDS });
    redis.now += (STATS_REFRESH_LOCK_TTL_SECONDS + 1) * 1000;
    await expect(refreshPersistedStatsSnapshot({ redis, build: async () => snapshot() })).resolves.toMatchObject({ status: "refreshed" });
  });

  it("keeps the lock lease above the deployed 60-second function limit", () => {
    expect(STATS_REFRESH_LOCK_TTL_SECONDS).toBeGreaterThan(60);
  });

  it("preserves the previous snapshot and skips cooldown when a phase times out", async () => {
    const redis = fakeRedis();
    const old = snapshot();
    redis.values.set(STATS_SNAPSHOT_KEY, old);
    await expect(refreshPersistedStatsSnapshot({
      redis,
      build: () => withinRefreshPhase({
        phase: "stats_rpcs",
        budgetMs: 1,
        run: async () => new Promise<PersistedStatsSnapshot>((resolve) => setTimeout(() => resolve(snapshot()), 20)),
      }),
    })).rejects.toThrow("stats_rpcs");
    expect(redis.values.get(STATS_SNAPSHOT_KEY)).toBe(old);
    expect(redis.values.get(STATS_REFRESH_COOLDOWN_KEY)).toBeUndefined();
    expect(STATS_RPC_PHASE_BUDGET_MS).toBeLessThan(60_000);
  });

  it("does not build again during the successful refresh cooldown", async () => {
    const redis = fakeRedis();
    let builds = 0;
    await expect(refreshPersistedStatsSnapshot({
      redis,
      build: async () => {
        builds += 1;
        return snapshot();
      },
    })).resolves.toMatchObject({ status: "refreshed" });
    await expect(refreshPersistedStatsSnapshot({
      redis,
      build: async () => {
        builds += 1;
        return snapshot();
      },
    })).resolves.toMatchObject({ status: "cooldown" });
    expect(redis.values.get(STATS_REFRESH_COOLDOWN_KEY)).toBeDefined();
    expect(builds).toBe(1);
  });

  it("rejects a structurally valid partial refresh even when marked unavailable", async () => {
    const redis = fakeRedis();
    const old = snapshot();
    redis.values.set(STATS_SNAPSHOT_KEY, old);
    const partial = snapshot();
    partial.stats.retention = null;
    partial.stats.dataIntegrity.failedRpcs = ["stats_retention"];
    partial.availability.rpcs.stats_retention = "temporarily_unavailable";
    await expect(refreshPersistedStatsSnapshot({ redis, build: async () => partial })).resolves.toEqual({ status: "incomplete" });
    expect(redis.values.get(STATS_SNAPSHOT_KEY)).toBe(old);
    expect(redis.values.has(STATS_REFRESH_COOLDOWN_KEY)).toBe(false);
  });

  it("rejects null required results even if failedRpcs is incorrectly empty", async () => {
    const redis = fakeRedis();
    const partial = snapshot();
    partial.stats.activation = null;
    await expect(refreshPersistedStatsSnapshot({ redis, build: async () => partial })).resolves.toEqual({ status: "incomplete" });
    expect(redis.values.has(STATS_SNAPSHOT_KEY)).toBe(false);
  });

  it("preserves a stale snapshot on rejection and allows a later retry", async () => {
    const redis = fakeRedis();
    const old = snapshot();
    redis.values.set(STATS_SNAPSHOT_KEY, old);
    await expect(refreshPersistedStatsSnapshot({ redis, build: async () => { throw new Error("test failure"); } })).rejects.toThrow("test failure");
    expect(redis.values.has(STATS_REFRESH_LOCK_KEY)).toBe(false);
    redis.now += 24 * 60 * 60 * 1000;
    await expect(readPersistedStatsSnapshot(redis)).resolves.toEqual(old);
    await expect(refreshPersistedStatsSnapshot({ redis, build: async () => snapshot() })).resolves.toHaveProperty("status", "refreshed");
  });

  it("serves the unchanged snapshot while another worker revalidates", async () => {
    const redis = fakeRedis();
    const old = snapshot();
    redis.values.set(STATS_SNAPSHOT_KEY, old);
    let release!: (value: PersistedStatsSnapshot) => void;
    const pending = refreshPersistedStatsSnapshot({ redis, build: () => new Promise((resolve) => { release = resolve; }) });
    // Lock acquisition and cooldown lookup are async even with this fake.
    while (!release) await Promise.resolve();
    await expect(readPersistedStatsSnapshot(redis)).resolves.toEqual(old);
    release(snapshot("2026-09-15T00:15:00.000Z"));
    await expect(pending).resolves.toHaveProperty("status", "refreshed");
  });

  it("recomputes only after the 900-second cooldown expires and keeps the same response shape", async () => {
    const redis = fakeRedis();
    const value = snapshot();
    await refreshPersistedStatsSnapshot({ redis, build: async () => value });
    redis.now = STATS_REFRESH_COOLDOWN_SECONDS * 1000 - 1;
    await expect(refreshPersistedStatsSnapshot({ redis, build: async () => value })).resolves.toEqual({ status: "cooldown" });
    redis.now += 1;
    await expect(refreshPersistedStatsSnapshot({ redis, build: async () => value })).resolves.toHaveProperty("status", "refreshed");
    await expect(readPersistedStatsSnapshot(redis)).resolves.toEqual(value);
    expect(Object.keys((await readPersistedStatsSnapshot(redis))!.stats).sort()).toEqual(Object.keys(EMPTY_PUBLIC_STATS).sort());
  });

  it("an expired worker cannot publish or release its successor's lock", async () => {
    const redis = fakeRedis();
    const old = snapshot();
    redis.values.set(STATS_SNAPSHOT_KEY, old);
    const result = await refreshPersistedStatsSnapshot({ redis, build: async () => {
      redis.now += STATS_REFRESH_LOCK_TTL_SECONDS * 1000;
      await redis.set(STATS_REFRESH_LOCK_KEY, "successor", { nx: true, ex: STATS_REFRESH_LOCK_TTL_SECONDS });
      return snapshot("2026-09-15T00:15:00.000Z");
    } });
    expect(result).toEqual({ status: "locked" });
    expect(redis.values.get(STATS_REFRESH_LOCK_KEY)).toBe("successor");
    expect(redis.values.get(STATS_SNAPSHOT_KEY)).toBe(old);
    expect(redis.values.has(STATS_REFRESH_COOLDOWN_KEY)).toBe(false);
  });

  it("publication failure preserves the prior snapshot and leaves no success cooldown", async () => {
    const redis = fakeRedis();
    const old = snapshot();
    redis.values.set(STATS_SNAPSHOT_KEY, old);
    const evalRedis = redis.eval;
    redis.eval = async (script, keys, args) => {
      if (keys.length === 3) throw new Error("Redis unavailable");
      return evalRedis(script, keys, args);
    };
    await expect(refreshPersistedStatsSnapshot({ redis, build: async () => snapshot() })).rejects.toThrow("Redis unavailable");
    expect(redis.values.get(STATS_SNAPSHOT_KEY)).toBe(old);
    expect(redis.values.has(STATS_REFRESH_COOLDOWN_KEY)).toBe(false);
  });
});
