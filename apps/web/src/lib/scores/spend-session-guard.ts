/**
 * Peones spend — caller-authorization guard (P0, 2026-08-10).
 *
 * WHY THIS EXISTS
 * ---------------
 * `POST /api/peones/spend` took the debited `wallet` from the request body and
 * gated the route with `enforceOrigin` + an IP limit only. `enforceOrigin`
 * passes any caller that omits both `Origin` and `Referer` (its own comment
 * says so), and the route holds the `service_role` key, which bypasses the
 * `peones_ledger` RLS that would otherwise stop a client write. Net effect: a
 * third party could POST a victim's public address and debit their Peones. It
 * is grief rather than theft — the rows credit/​debit the named wallet, and
 * balances are tiny — but it is an unauthorized debit and it must be closed
 * before the retention work makes Peones more valuable.
 *
 * THE FIX, MIRRORING THE SCORE PATH
 * ---------------------------------
 * `/api/scores/save` proved the wallet cannot come from the body: it comes from
 * a score write-session the wallet bought with one EIP-191 signature, and the
 * server resolves it from the session row (`save_score_attempt`'s `p_token_hash`).
 * The same capability authorizes a spend: a valid, unexpired, unrevoked,
 * *authorized* session token proves the caller controls the wallet.
 *
 * This module resolves that token to a wallet at the ROUTE layer (a read of
 * `score_write_sessions`, the same table the score path signs into) so the fix
 * ships without a migration. The durable follow-up moves the resolution INTO
 * `peones_spend` so the grantor — not each caller — owns the check; see
 * `docs/security/2026-08-10-peones-spend-authz.md`. Until that migration is
 * applied and the token-carrying client has propagated, enforcement is gated by
 * `PEONES_SPEND_REQUIRE_SESSION` so the rollout order is: ship client → verify
 * token propagation → flip the flag. With the flag off, the route is byte-for-
 * byte its old self.
 *
 * PURE-ish: no `Date.now()` default is baked in — the caller passes `nowMs` so
 * the expiry check is testable without faking the clock.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ScoreSaveSurface } from "@/lib/scores/save-authorization";
import {
  hashSessionToken,
  isSessionTokenShape,
} from "@/lib/server/score-session-store";
import { SCORE_SESSION_CLOCK_SKEW_SECONDS } from "@/lib/scores/session-authorization";

/** `Authorization: Bearer <64 hex>`, shape-checked before it reaches the DB.
 *  Mirrors the score save route's reader so a junk header is a cheap null. */
export function readSpendBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer ([0-9a-f]{64})$/.exec(header.trim());
  if (!match) return null;
  return isSessionTokenShape(match[1]) ? match[1] : null;
}

/**
 * Is server-side enforcement on?
 *
 * OFF by default and read at request time so it can be flipped by config
 * without a redeploy. Off = the route keeps its legacy body-wallet behaviour
 * unchanged; on = a valid session token is mandatory and the wallet comes from
 * the session, never the body. Kept off until the token-carrying client build
 * has propagated, because — unlike the score path — spend has no absent-id
 * grace, so an older bundle loses the ability to spend the moment the token is
 * required.
 */
export function isSpendSessionRequired(): boolean {
  return process.env.PEONES_SPEND_REQUIRE_SESSION === "true";
}

export type SpendSessionResolution =
  | { status: "ok"; wallet: string; surface: ScoreSaveSurface }
  /** Token missing, malformed, unknown, unsigned, revoked or expired. Fail the
   *  request CLOSED — a debit is never urgent enough to let an unproven caller
   *  through. */
  | { status: "invalid"; reason: SpendSessionInvalidReason }
  /** The session store could not be reached. Also fail closed (503), never
   *  "let it through": an unreachable store means no proof, and no debit is
   *  urgent enough for that. */
  | { status: "unavailable" };

export type SpendSessionInvalidReason =
  | "no_token"
  | "not_found"
  | "unsigned"
  | "revoked"
  | "expired";

type SessionRow = {
  wallet: string;
  surface: string;
  expires_at: string;
  revoked_at: string | null;
  authorized_at: string | null;
};

/**
 * Resolve a bearer token to the wallet its session belongs to.
 *
 * Note what is NOT a parameter: a wallet. The identity comes out of the row, so
 * a token can only ever authorize a spend on its own wallet — the property is
 * structural, exactly as it is on the consume path (`score-session-store.ts`).
 *
 * The row must be a real, *authorized* session (`token_hash` is only set when
 * the challenge is signed), not revoked, and not past `expires_at` (with the
 * same clock-skew tolerance the score challenge validator allows for mobile
 * clocks). Anything else is `invalid`, fail-closed.
 */
export async function resolveSpendSessionWallet(
  supabase: SupabaseClient,
  token: string | null,
  nowMs: number,
): Promise<SpendSessionResolution> {
  if (!token || !isSessionTokenShape(token)) {
    return { status: "invalid", reason: "no_token" };
  }

  const { data, error } = await supabase
    .from("score_write_sessions")
    .select("wallet, surface, expires_at, revoked_at, authorized_at")
    .eq("token_hash", hashSessionToken(token))
    .maybeSingle();

  if (error) {
    return { status: "unavailable" };
  }
  const row = data as SessionRow | null;
  if (!row) {
    return { status: "invalid", reason: "not_found" };
  }
  // A row whose token_hash matched but was never authorized cannot exist
  // (token_hash is NULL until authorize), but check anyway — belt and braces.
  if (!row.authorized_at) {
    return { status: "invalid", reason: "unsigned" };
  }
  if (row.revoked_at) {
    return { status: "invalid", reason: "revoked" };
  }
  const expiresMs = Date.parse(row.expires_at);
  if (
    !Number.isFinite(expiresMs) ||
    nowMs > expiresMs + SCORE_SESSION_CLOCK_SKEW_SECONDS * 1000
  ) {
    return { status: "invalid", reason: "expired" };
  }

  const surface: ScoreSaveSurface = row.surface === "play" ? "play" : "learn";
  return { status: "ok", wallet: row.wallet.toLowerCase(), surface };
}
