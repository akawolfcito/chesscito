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
  getSurfaceBreakdown: mocks.breakdown,
}));
vi.mock("@/lib/stats/players-census", () => ({ readPlayersCensus: mocks.census }));

import { POST } from "../route";
import { EMPTY_PUBLIC_STATS } from "@/lib/stats/types";

function healthyStats() {
  return {
    ...EMPTY_PUBLIC_STATS,
    generatedAt: new Date().toISOString(),
    installs: {},
    dataIntegrity: { failedRpcs: [] },
  };
}

function fakeRedis() {
  const values = new Map<string, unknown>();
  return {
    get: vi.fn(async (key: string) => values.get(key) ?? null),
    set: vi.fn(async (key: string, value: unknown, options?: { nx?: boolean }) => {
      if (options?.nx && values.has(key)) return null;
      values.set(key, value);
      return "OK";
    }),
    eval: vi.fn(async (_script: string, keys: string[], args: string[]) => {
      if (values.get(keys[0]) === args[0]) values.delete(keys[0]);
      return 1;
    }),
  };
}

describe("POST /api/internal/stats/refresh", () => {
  beforeEach(() => {
    process.env.STATS_REFRESH_SECRET = "test-secret";
    mocks.stats.mockReset();
    mocks.breakdown.mockReset();
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
    mocks.breakdown.mockResolvedValue({ learn: {}, play: {}, total: {} });
    mocks.census.mockResolvedValue({ rows: [], total: 1, rowsRead: "ok", asOf: new Date().toISOString() });
    const response = await POST(new NextRequest("https://www.chesscito.com/api/internal/stats/refresh", {
      method: "POST", headers: { authorization: "Bearer test-secret" },
    }));
    expect(response.status).toBe(200);
    expect(mocks.stats).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenCalledTimes(3);
  });

  it("rejects a second authenticated refresh during the six-hour cooldown", async () => {
    const redis = fakeRedis();
    mocks.redis.mockReturnValue(redis);
    mocks.stats.mockResolvedValue(healthyStats());
    mocks.breakdown.mockResolvedValue({ learn: {}, play: {}, total: {} });
    mocks.census.mockResolvedValue({ rows: [], total: 1, rowsRead: "ok", asOf: new Date().toISOString() });
    const request = new NextRequest("https://www.chesscito.com/api/internal/stats/refresh", {
      method: "POST", headers: { authorization: "Bearer test-secret" },
    });

    await expect(POST(request)).resolves.toHaveProperty("status", 200);
    const cooldown = await POST(request);
    await expect(cooldown.json()).resolves.toEqual({ refreshed: false, reason: "refresh_cooldown" });
    expect(cooldown.status).toBe(429);
    expect(cooldown.headers.get("Retry-After")).toBe("21600");
    expect(mocks.stats).toHaveBeenCalledTimes(1);
  });
});
