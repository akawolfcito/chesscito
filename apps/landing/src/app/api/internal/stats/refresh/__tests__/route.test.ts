import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redis: vi.fn(),
  stats: vi.fn(),
  breakdown: vi.fn(),
  census: vi.fn(),
}));

vi.mock("@/lib/stats/redis", () => ({ getStatsRedis: mocks.redis }));
vi.mock("@/lib/stats/aggregator", () => ({
  getPublicStats: mocks.stats,
  STATS_RPCS: [
    "stats_install_counts", "stats_activation_funnel", "stats_access_funnel", "stats_top_countries",
    "stats_retention", "stats_account_lifecycle", "stats_habit_depth", "stats_activity_trend",
  ],
  EMERGENCY_STATS_RPCS: [
    "stats_activation_funnel", "stats_access_funnel", "stats_retention", "stats_account_lifecycle", "stats_activity_trend",
  ],
}));
vi.mock("@/lib/stats/players-census", () => ({
  EMPTY_PLAYERS_CENSUS: { rows: [], total: null, rowsRead: "unavailable", asOf: new Date(0).toISOString() },
  readPlayersCensus: mocks.census,
}));

import { POST } from "../route";
import { EMPTY_PUBLIC_STATS } from "@/lib/stats/types";
import { STATS_SNAPSHOT_KEY, STATS_REFRESH_COOLDOWN_KEY, STATS_REFRESH_LOCK_KEY } from "@/lib/stats/persisted-snapshot";

function healthyStats() {
  return {
    ...EMPTY_PUBLIC_STATS,
    generatedAt: new Date().toISOString(),
    activation: [],
    accessFunnel: { steps: [], failedSessions: 0 },
    retention: { d1: { returned: 0, cohort: 0 }, d7: { returned: 0, cohort: 0 }, week3: { returned: 0, cohort: 0 } },
    accountLifecycle: { known: 0, newToday: 0, new7d: 0, active7d: 0, dormant: 0, inactive: 0, resurrected7d: 0 },
    dataIntegrity: { failedRpcs: ["stats_install_counts", "stats_top_countries", "stats_habit_depth"] },
  };
}

function fakeRedis() {
  const values = new Map<string, unknown>();
  return {
    values,
    get: vi.fn(async (key: string) => values.get(key) ?? null),
    set: vi.fn(async (key: string, value: unknown, options?: { nx?: boolean }) => {
      if (options?.nx && values.has(key)) return null;
      values.set(key, value);
      return "OK";
    }),
    eval: vi.fn(async (_script: string, keys: string[], args: string[]) => {
      if (values.get(keys[0]) !== args[0]) return 0;
      if (keys.length === 3) {
        values.set(keys[1], JSON.parse(args[1]));
        values.set(keys[2], args[2]);
      } else values.delete(keys[0]);
      return 1;
    }),
  };
}

describe("POST /api/internal/stats/refresh", () => {
  beforeEach(() => {
    process.env.STATS_REFRESH_SECRET = "test-secret";
    mocks.stats.mockReset();
    mocks.census.mockReset();
    mocks.redis.mockReset();
  });

  it("rejects unauthorized callers before Redis or Supabase", async () => {
    const response = await POST(new NextRequest("https://www.chesscito.com/api/internal/stats/refresh", { method: "POST" }));
    expect(response.status).toBe(401);
    expect(mocks.redis).not.toHaveBeenCalled();
    expect(mocks.stats).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", undefined, "Bearer test-secret"],
    ["whitespace", "   ", "Bearer test-secret"],
    ["incorrect", "test-secret", "Bearer wrong-secret"],
  ])("rejects a %s secret before Redis or Supabase", async (_case, secret, authorization) => {
    if (secret === undefined) delete process.env.STATS_REFRESH_SECRET;
    else process.env.STATS_REFRESH_SECRET = secret;
    const response = await POST(new NextRequest("https://www.chesscito.com/api/internal/stats/refresh", {
      method: "POST", headers: { authorization },
    }));
    expect(response.status).toBe(401);
    expect(mocks.redis).not.toHaveBeenCalled();
    expect(mocks.stats).not.toHaveBeenCalled();
  });

  it("generates and writes a complete snapshot only through the protected endpoint", async () => {
    const redis = fakeRedis();
    mocks.redis.mockReturnValue(redis);
    mocks.stats.mockResolvedValue(healthyStats());
    const response = await POST(new NextRequest("https://www.chesscito.com/api/internal/stats/refresh", {
      method: "POST", headers: { authorization: "Bearer test-secret" },
    }));
    expect(response.status).toBe(200);
    expect(mocks.stats).toHaveBeenCalledTimes(1);
    expect(mocks.stats).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      includeOnchain: false,
      signal: expect.any(AbortSignal),
      rpcNames: ["stats_activation_funnel", "stats_access_funnel", "stats_retention", "stats_account_lifecycle", "stats_activity_trend"],
      rpcTimeoutMs: 8_000,
    }));
    expect(mocks.census).not.toHaveBeenCalled();
    expect(redis.set).toHaveBeenCalledTimes(1);
    expect(redis.eval).toHaveBeenCalledTimes(2);
    await expect(response.json()).resolves.toEqual({ refreshed: true, refreshedAt: expect.any(String) });
  });

  it("rejects a second authenticated refresh during the 15-minute cooldown", async () => {
    const redis = fakeRedis();
    mocks.redis.mockReturnValue(redis);
    mocks.stats.mockResolvedValue(healthyStats());
    const request = new NextRequest("https://www.chesscito.com/api/internal/stats/refresh", {
      method: "POST", headers: { authorization: "Bearer test-secret" },
    });

    await expect(POST(request)).resolves.toHaveProperty("status", 200);
    const cooldown = await POST(request);
    await expect(cooldown.json()).resolves.toEqual({ refreshed: false, reason: "refresh_cooldown" });
    expect(cooldown.status).toBe(429);
    expect(cooldown.headers.get("Retry-After")).toBe("900");
    expect(mocks.stats).toHaveBeenCalledTimes(1);
  });

  it("logs phase timings without the refresh secret", async () => {
    const redis = fakeRedis();
    mocks.redis.mockReturnValue(redis);
    mocks.stats.mockResolvedValue(healthyStats());
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    await POST(new NextRequest("https://www.chesscito.com/api/internal/stats/refresh", {
      method: "POST", headers: { authorization: "Bearer test-secret" },
    }));
    expect(info).toHaveBeenCalled();
    expect(JSON.stringify(info.mock.calls)).not.toContain("test-secret");
    info.mockRestore();
  });

  it("preserves the previous snapshot when an attempted RPC fails", async () => {
    const redis = fakeRedis();
    mocks.redis.mockReturnValue(redis);
    mocks.stats.mockResolvedValue(healthyStats());
    const request = new NextRequest("https://www.chesscito.com/api/internal/stats/refresh", {
      method: "POST", headers: { authorization: "Bearer test-secret" },
    });
    expect((await POST(request)).status).toBe(200);
    const previous = redis.values.get(STATS_SNAPSHOT_KEY);
    redis.values.delete(STATS_REFRESH_COOLDOWN_KEY);
    mocks.stats.mockResolvedValue({ ...healthyStats(), retention: null, dataIntegrity: {
      failedRpcs: [...healthyStats().dataIntegrity.failedRpcs, "stats_retention"],
    } });
    const response = await POST(request);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ refreshed: false, reason: "incomplete_snapshot" });
    expect(redis.values.get(STATS_SNAPSHOT_KEY)).toBe(previous);
    expect(redis.values.has(STATS_REFRESH_COOLDOWN_KEY)).toBe(false);
  });

  it("rejects an unconfigured/empty aggregator result instead of publishing unavailable required data", async () => {
    const redis = fakeRedis();
    mocks.redis.mockReturnValue(redis);
    mocks.stats.mockResolvedValue(EMPTY_PUBLIC_STATS);
    const response = await POST(new NextRequest("https://www.chesscito.com/api/internal/stats/refresh", {
      method: "POST", headers: { authorization: "Bearer test-secret" },
    }));
    expect(response.status).toBe(503);
    expect(redis.values.has(STATS_SNAPSHOT_KEY)).toBe(false);
  });

  it("returns 409 for a distributed lock held by another worker before computing", async () => {
    const redis = fakeRedis();
    redis.values.set(STATS_REFRESH_LOCK_KEY, "other-worker");
    mocks.redis.mockReturnValue(redis);
    const response = await POST(new NextRequest("https://www.chesscito.com/api/internal/stats/refresh", {
      method: "POST", headers: { authorization: "Bearer test-secret" },
    }));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ refreshed: false, reason: "refresh_in_progress" });
    expect(mocks.stats).not.toHaveBeenCalled();
  });
});
