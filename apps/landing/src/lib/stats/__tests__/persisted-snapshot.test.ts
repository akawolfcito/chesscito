import { describe, expect, it } from "vitest";

import {
  STATS_REFRESH_LOCK_KEY,
  STATS_REFRESH_LOCK_TTL_SECONDS,
  STATS_REFRESH_COOLDOWN_KEY,
  STATS_SNAPSHOT_KEY,
  asPersistedSnapshot,
  readPersistedStatsSnapshot,
  refreshPersistedStatsSnapshot,
  type PersistedStatsSnapshot,
  type StatsRedis,
} from "../persisted-snapshot";
import { EMPTY_PUBLIC_STATS } from "../types";

function snapshot(stamp = "2026-09-15T00:00:00.000Z"): PersistedStatsSnapshot {
  return asPersistedSnapshot({
    stats: {
      ...EMPTY_PUBLIC_STATS,
      generatedAt: stamp,
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
      if (values.get(keys[0]) === args[0]) values.delete(keys[0]);
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

  it("replaces only a complete successful snapshot", async () => {
    const redis = fakeRedis();
    const old = snapshot("2026-09-15T00:00:00.000Z");
    const fresh = snapshot("2026-09-15T06:00:00.000Z");
    redis.values.set(STATS_SNAPSHOT_KEY, old);
    const result = await refreshPersistedStatsSnapshot({ redis, build: async () => fresh });
    expect(result.status).toBe("refreshed");
    expect(redis.values.get(STATS_SNAPSHOT_KEY)).toBe(fresh);
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

  it("allows only one concurrent regeneration", async () => {
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
    const second = await refreshPersistedStatsSnapshot({ redis, build });
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
});
