import { afterEach, describe, expect, it, vi } from "vitest";

import { __resetLoggerSink, __setLoggerSink, createLogger } from "../logger";
import {
  estimateSlidingWindowCommands,
  recordRedisUsage,
  shouldObserveRedis,
} from "../redis-observability";

afterEach(() => {
  __resetLoggerSink();
  vi.unstubAllEnvs();
});

describe("Redis observability", () => {
  it("uses the documented sliding-window estimates without touching Redis", () => {
    expect(estimateSlidingWindowCommands({ outcome: "allowed", limit: 60, remaining: 59 })).toBe(5);
    expect(estimateSlidingWindowCommands({ outcome: "allowed", limit: 60, remaining: 10 })).toBe(4);
    expect(estimateSlidingWindowCommands({ outcome: "limited" })).toBe(3);
    expect(estimateSlidingWindowCommands({ outcome: "limited", reason: "cacheBlock" })).toBe(0);
  });

  it("emits only aggregate fields and never identifiers or keys", () => {
    vi.stubEnv("REDIS_OBSERVABILITY_SAMPLE_RATE", "1");
    const lines: string[] = [];
    __setLoggerSink((line) => lines.push(line));

    recordRedisUsage(createLogger({ route: "/api/coach/history" }), {
      redis_feature: "coach_history",
      redis_logical_operation: "list_and_hydrate",
      endpoint: "/api/coach/history",
      redis_estimated_commands: 41,
      cache_result: "hit",
      items_requested: 20,
      items_returned: 19,
    });

    expect(lines).toHaveLength(1);
    const record = JSON.parse(lines[0]!);
    expect(record).toMatchObject({ msg: "redis_usage", redis_feature: "coach_history" });
    expect(JSON.stringify(record)).not.toMatch(/wallet|ip|redis.*key|token|secret/i);
  });

  it("retains every healthy observation when the sample rate is 1", () => {
    vi.stubEnv("REDIS_OBSERVABILITY_SAMPLE_RATE", "1");
    expect(shouldObserveRedis({
      redis_feature: "games_list",
      redis_logical_operation: "list",
      endpoint: "/api/games",
      redis_estimated_commands: 1,
    })).toBe(true);
  });

  it("retains denials and backend outcomes even when healthy sampling is disabled", () => {
    vi.stubEnv("REDIS_OBSERVABILITY_SAMPLE_RATE", "0");
    for (const rate_limit_outcome of ["limited", "redis_error", "redis_timeout"] as const) {
      expect(shouldObserveRedis({
        redis_feature: "rate_limit",
        redis_logical_operation: "sliding_window",
        endpoint: "/api/pro/status",
        redis_estimated_commands: 4,
        rate_limit_outcome,
      })).toBe(true);
    }
  });
});
