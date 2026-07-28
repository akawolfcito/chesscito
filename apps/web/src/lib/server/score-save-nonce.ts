/**
 * SaveScore — one-shot nonce burn (Slice 0 replay guard).
 *
 * A valid signature is a bearer token: whoever captures it can resend it until
 * it expires. `expiresAt` shrinks that window to minutes; this module closes
 * it entirely by making each authorization spendable exactly once.
 *
 * The guard is the PRIMARY KEY on `score_save_nonces (wallet, nonce)`, not a
 * SELECT-then-INSERT: two concurrent replays of the same payload must not both
 * observe "unused" and both proceed. We insert first and read the outcome.
 *
 * Deliberately NOT an in-process Set / LRU: that resets on every redeploy and
 * is per-instance on a serverless platform, so it would be protection only
 * against an attacker who does not retry.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { createLogger } from "@/lib/server/logger";

const log = createLogger({ route: "score-save-nonce" });

/** Postgres unique_violation. The nonce was already spent. */
const UNIQUE_VIOLATION = "23505";

export type NonceBurnResult =
  /** First use — the caller may proceed with the write. */
  | { status: "consumed" }
  /** Already spent. This is a replay. */
  | { status: "replayed" }
  /** The store is unreachable. The caller MUST fail closed: without the burn
   *  there is no replay protection, and a save is never urgent enough to skip
   *  it. */
  | { status: "unavailable" };

/**
 * Spend a nonce. Returns `consumed` only on a genuinely first use.
 *
 * `expiresAtSeconds` is the value from the signed payload, stored so a purge
 * job can reclaim the row later without re-parsing the message.
 */
export async function consumeScoreSaveNonce(
  supabase: SupabaseClient,
  wallet: string,
  nonce: string,
  expiresAtSeconds: number,
): Promise<NonceBurnResult> {
  const { error } = await supabase.from("score_save_nonces").insert({
    wallet: wallet.toLowerCase(),
    nonce,
    expires_at: new Date(expiresAtSeconds * 1000).toISOString(),
  });

  if (!error) {
    return { status: "consumed" };
  }

  if (error.code === UNIQUE_VIOLATION) {
    return { status: "replayed" };
  }

  // Anything else (table missing, RLS, network) is an infrastructure failure.
  // Fail closed — see NonceBurnResult.
  log.error("nonce_burn_failed", { code: error.code, message: error.message });
  return { status: "unavailable" };
}
