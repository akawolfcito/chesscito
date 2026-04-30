import { Redis } from "@upstash/redis";
import { REDIS_KEYS } from "@/lib/coach/redis-keys";

const redis = Redis.fromEnv();

export type ProStatus = {
  active: boolean;
  expiresAt: number | null;
};

/** Read-only check for an active Chesscito PRO pass. Returns
 *  `{ active: false, expiresAt: null }` for the four "no PRO" cases:
 *  missing key, null value, NaN/invalid value, and expired timestamp.
 *
 *  Wallet is normalized to lowercase to match the convention used by
 *  /api/verify-pro when writing the key. Any caller passing a
 *  checksummed address still hits the same Redis row.
 *
 *  Never throws on missing PRO — callers can short-circuit with the
 *  returned `active` boolean. Errors from Redis itself surface as a
 *  rejected promise (caller decides whether to treat as no-PRO). */
export async function isProActive(wallet: string): Promise<ProStatus> {
  const key = REDIS_KEYS.pro(wallet.toLowerCase());
  const raw = await redis.get<string | number | null>(key);
  if (raw == null) return { active: false, expiresAt: null };

  const expiresAt = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(expiresAt)) return { active: false, expiresAt: null };

  return { active: expiresAt > Date.now(), expiresAt };
}
