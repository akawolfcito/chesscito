import type { Redis } from "@upstash/redis";
import { PRO_DURATION_DAYS } from "@/lib/contracts/shop-catalog";

export const PRO_DURATION_MS = PRO_DURATION_DAYS * 24 * 60 * 60 * 1000;

/**
 * Atomic extend-or-set for the PRO pass, shared by every grant path
 * (Shop buyItem via /api/verify-pro, and the no-approve rail via
 * /api/verify-payment) so both compose against the same Redis value
 * instead of one path's shorter extension overwriting the other's
 * longer one.
 * - If no PRO active: expiresAt = now + PRO_DURATION_MS
 * - If PRO active   : expiresAt = currentExpiresAt + PRO_DURATION_MS
 * - If PRO expired  : expiresAt = now + PRO_DURATION_MS
 * TTL is sized to the new expiresAt so the key auto-purges at lapse.
 */
export const PRO_EXTEND_LUA = `
  local cur = redis.call('GET', KEYS[1])
  local now = tonumber(ARGV[1])
  local addMs = tonumber(ARGV[2])
  local base
  if cur and tonumber(cur) and tonumber(cur) > now then
    base = tonumber(cur)
  else
    base = now
  end
  local newExpiresAt = base + addMs
  local ttlSec = math.ceil((newExpiresAt - now) / 1000)
  redis.call('SET', KEYS[1], tostring(newExpiresAt), 'EX', ttlSec)
  return tostring(newExpiresAt)
`;

export async function extendProExpiry(redis: Redis, key: string): Promise<number> {
  const result = await redis.eval(PRO_EXTEND_LUA, [key], [Date.now(), PRO_DURATION_MS]);
  return Number(result);
}
