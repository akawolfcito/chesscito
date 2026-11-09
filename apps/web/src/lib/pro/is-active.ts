import { readProStatus, type ProStatus } from "./expiry-reader";
import { redisProExpiryReader } from "./redis-expiry-reader";

export type { ProStatus } from "./expiry-reader";

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
  return readProStatus(redisProExpiryReader, wallet);
}
