import "server-only";

import { Redis } from "@upstash/redis";

let client: Redis | null = null;

/** The public page reads one small Redis value; cron uses the same shared DB. */
export function getStatsRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  if (!client) client = Redis.fromEnv();
  return client;
}

/** Test hook. */
export function __resetStatsRedis(): void {
  client = null;
}
