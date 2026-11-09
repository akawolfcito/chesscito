import { getRedis } from "@/lib/server/redis";
import { REDIS_KEYS } from "@/lib/coach/redis-keys";
import type { ProExpiryReader } from "./expiry-reader";

const redis = getRedis();

/** Current production adapter. A future SQL reader must satisfy the same
 * expiry/error contract before callers can switch away from this adapter. */
export const redisProExpiryReader: ProExpiryReader = {
  getExpiresAt: (wallet) => redis.get<string | number | null>(REDIS_KEYS.pro(wallet)),
};
