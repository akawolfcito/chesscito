import { createHash } from "node:crypto";
import { isAddress, verifyMessage } from "viem";

/**
 * Welcome Pack — server-side claim utilities.
 *
 * Shared between /api/welcome-pack/claim and /api/welcome-pack/status.
 * Pure functions — no Redis, no Supabase, no env reads here (except
 * `hashIp` which reads CLAIM_IP_HASH_SALT). Easier to unit-test.
 *
 * Spec: _bmad-output/planning-artifacts/ux-shield-rescue-and-welcome-
 * pack-2026-05-31.md §5.2.
 */

export const WELCOME_PACK_SHIELDS = 3;

/** Replay window: signed messages older or newer than this from server
 *  time are rejected. ±5min accommodates clock skew on mobile devices
 *  while shrinking the replay surface to a manageable window. */
export const WELCOME_PACK_REPLAY_WINDOW_MS = 5 * 60 * 1000;

/** Canonical signed-message format. Versioned implicitly by the literal
 *  string — if we ever need to roll the schema, change this prefix and
 *  bump verification logic. */
const MESSAGE_RE =
  /^Chesscito Welcome Pack — claim for (0x[a-fA-F0-9]{40}) at (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)$/;

export function buildClaimMessage(address: string, timestamp: string): string {
  return `Chesscito Welcome Pack — claim for ${address} at ${timestamp}`;
}

export type WelcomePackClaimInput = {
  address: string;
  signature: string;
  message: string;
};

export type WelcomePackClaimError =
  | "invalid_address"
  | "invalid_message"
  | "stale_request"
  | "signature_mismatch";

export type WelcomePackValidation =
  | { ok: true; address: `0x${string}` }
  | { ok: false; error: WelcomePackClaimError };

/**
 * Validate a claim payload end-to-end:
 *   1. Address is EIP-55-checksummable
 *   2. Message matches canonical format
 *   3. Address inside the message matches the body address (case-insensitive)
 *   4. Timestamp falls within ±WELCOME_PACK_REPLAY_WINDOW_MS of `now`
 *   5. Signature recovers to the claimed address (EIP-191 personal_sign)
 *
 * Returns a discriminated union — caller maps `error` to HTTP status.
 */
export async function validateClaimInput(
  input: WelcomePackClaimInput,
  now: number = Date.now(),
): Promise<WelcomePackValidation> {
  if (!isAddress(input.address)) {
    return { ok: false, error: "invalid_address" };
  }

  const match = MESSAGE_RE.exec(input.message);
  if (!match) {
    return { ok: false, error: "invalid_message" };
  }

  const [, msgAddress, msgTimestamp] = match;
  if (msgAddress.toLowerCase() !== input.address.toLowerCase()) {
    return { ok: false, error: "invalid_message" };
  }

  const timestamp = Date.parse(msgTimestamp);
  if (
    Number.isNaN(timestamp) ||
    Math.abs(now - timestamp) > WELCOME_PACK_REPLAY_WINDOW_MS
  ) {
    return { ok: false, error: "stale_request" };
  }

  let valid = false;
  try {
    valid = await verifyMessage({
      address: input.address as `0x${string}`,
      message: input.message,
      signature: input.signature as `0x${string}`,
    });
  } catch {
    return { ok: false, error: "signature_mismatch" };
  }
  if (!valid) {
    return { ok: false, error: "signature_mismatch" };
  }

  return { ok: true, address: input.address as `0x${string}` };
}

/**
 * Hash an IP for Phase-2 rate limiting. Returns `null` when the salt env
 * is missing or the IP is "unknown" — both signal "do not record an IP
 * hash" rather than fall back to an unsalted hash (which would be
 * trivially rainbow-tablable). The migration schema permits NULL on
 * ip_hash precisely for this case.
 */
export function hashIp(ip: string): string | null {
  const salt = process.env.CLAIM_IP_HASH_SALT;
  if (!salt || ip === "unknown") return null;
  return createHash("sha256").update(`${ip}|${salt}`).digest("hex");
}

/** Hash a UA string for telemetry without storing the raw value.
 *  Stable across the same exact UA, so we can group by UA without
 *  identifying users. */
export function hashUserAgent(userAgent: string | null): string | null {
  if (!userAgent) return null;
  return createHash("sha256").update(userAgent).digest("hex");
}
