import { createHmac } from "node:crypto";

/**
 * Pseudonymous account identity for analytics. SERVER ONLY — importing this
 * client-side would ship the secret, which is the whole point of it existing.
 *
 * `account_ref` = HMAC-SHA256(lowercased address, TELEMETRY_ACCOUNT_SECRET),
 * truncated to 128 bits. It is an HMAC and not a plain hash because the set of
 * real wallet addresses is enumerable: an unkeyed SHA-256 of an address is
 * reversible by anyone holding a wallet list, so it would be a wallet column
 * wearing a costume. With a server-held secret the value is unlinkable to a
 * person, and rotating the secret deliberately orphans historical rows.
 *
 * The raw address reaches this function transiently from the request body and
 * is never persisted, logged, or returned.
 *
 * Every failure mode returns `null` — no secret configured, no wallet, a
 * malformed address — so account-level metrics degrade to "unavailable"
 * instead of silently wrong.
 */

/** 128 bits of the digest: collision-safe far past any plausible user count,
 *  and matches the `^[0-9a-f]{32}$` check constraint on the column. */
export const ACCOUNT_REF_LEN = 32;

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export function deriveAccountRef(
  address: unknown,
  secret: string | undefined = process.env.TELEMETRY_ACCOUNT_SECRET,
): string | null {
  if (!secret) return null;
  if (typeof address !== "string" || !ADDRESS_RE.test(address)) return null;
  return createHmac("sha256", secret)
    .update(address.toLowerCase())
    .digest("hex")
    .slice(0, ACCOUNT_REF_LEN);
}
