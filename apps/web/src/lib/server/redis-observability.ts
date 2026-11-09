import type { Logger } from "./logger";

/**
 * One aggregate observation for a logical Redis operation. This module never
 * receives a Redis key, address, IP, request object, or credential: keeping
 * the shape narrow makes accidental PII logging harder at call sites.
 */
export type RedisFeature =
  | "rate_limit"
  | "coach_history"
  | "games_list"
  | "coach_credits"
  | "coach_analyze"
  | "entitlement";

export type RedisCacheResult = "hit" | "miss" | "legacy_hit" | "locale_fallback";
export type RedisScope = "ip" | "wallet" | "both";

export type RedisUsageObservation = {
  redis_feature: RedisFeature;
  redis_logical_operation: string;
  endpoint: string;
  redis_estimated_commands: number;
  cache_result?: RedisCacheResult;
  items_requested?: number;
  items_returned?: number;
  rate_limit_outcome?: "allowed" | "limited" | "redis_error" | "redis_timeout";
  scopes?: RedisScope;
  poll_attempt?: number;
  poll_reason?: string;
  poll_terminal?: "ready" | "failed" | "timeout" | "not_ready";
};

function sampleRate(): number {
  const value = Number.parseFloat(process.env.REDIS_OBSERVABILITY_SAMPLE_RATE ?? "0.1");
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0.1;
}

/** Errors and denials are always retained; healthy high-volume operations are sampled. */
export function shouldObserveRedis(input: RedisUsageObservation): boolean {
  if (input.rate_limit_outcome && input.rate_limit_outcome !== "allowed") return true;
  return Math.random() < sampleRate();
}

export function recordRedisUsage(log: Logger, input: RedisUsageObservation): void {
  if (!shouldObserveRedis(input)) return;
  log.info("redis_usage", { ...input, redis_observability_sample_rate: sampleRate() });
}

/** Official Regional sliding-window costs. `remaining` identifies a fresh key. */
export function estimateSlidingWindowCommands(input: {
  outcome: RedisUsageObservation["rate_limit_outcome"];
  limit?: number;
  remaining?: number;
  reason?: string;
}): number {
  // @upstash/ratelimit answers a blocked identifier from its in-process
  // ephemeral cache without consulting Redis. It is still an application
  // denial, but it is not a billable Redis command.
  if (input.outcome === "limited") return input.reason === "cacheBlock" ? 0 : 3;
  if (input.outcome === "allowed") {
    return input.limit !== undefined && input.remaining === input.limit - 1 ? 5 : 4;
  }
  // A transport timeout/error may have reached Redis; retain a conservative
  // estimate rather than claiming zero.
  return 4;
}
