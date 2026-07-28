/**
 * Score write sessions — server-side store (Slice 0.1).
 *
 * Owns the three DB round trips of the session lifecycle: issue a challenge,
 * turn a signed challenge into a session, spend one save from it.
 *
 * The atomicity lives in Postgres (`authorize_score_write_session`,
 * `consume_score_write_session`), not here. This module is the typed seam over
 * those RPCs plus the token secret handling, which is the part that must not
 * be reinvented at each call site.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { ScoreSaveSurface } from "@/lib/scores/save-authorization";
import {
  SCORE_SESSION_CHALLENGE_TTL_SECONDS,
  SCORE_SESSION_MAX_SAVES,
  SCORE_SESSION_TTL_SECONDS,
} from "@/lib/scores/session-authorization";
import { createLogger } from "@/lib/server/logger";

const log = createLogger({ route: "score-session-store" });

// ─────────────────────────────────────────────────────────────────
// Secrets
// ─────────────────────────────────────────────────────────────────

/** 32 hex chars = 128 bits from the CSPRNG. Not derived from the wallet, the
 *  sessionId or the clock: a token that can be recomputed from public inputs
 *  is not a secret, it is an encoding. */
export function createSessionId(): string {
  return randomBytes(16).toString("hex");
}

/** 64 hex chars = 256 bits. Returned to the client ONCE and never stored. */
export function createSessionToken(): string {
  return randomBytes(32).toString("hex");
}

/** What actually lands in the table. A dump must not yield a usable
 *  credential. Plain SHA-256 (not a KDF) is correct here: the input is 256
 *  bits of CSPRNG output, so there is no guessable preimage to slow down —
 *  a KDF would only add latency to every save. */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** 64 lowercase hex. Shape-checked before it reaches the DB so a junk header
 *  is a cheap reject. */
const TOKEN_RE = /^[0-9a-f]{64}$/;

export function isSessionTokenShape(v: unknown): v is string {
  return typeof v === "string" && TOKEN_RE.test(v);
}

/** Constant-time compare, for the rare call site that compares tokens directly
 *  rather than by hash lookup. Exported so nobody reaches for `===`. */
export function tokensEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// ─────────────────────────────────────────────────────────────────
// Challenge
// ─────────────────────────────────────────────────────────────────

export type IssuedChallenge = {
  sessionId: string;
  issuedAt: number;
  expiresAt: number;
  maxSaves: number;
};

export type IssueChallengeResult =
  | { status: "issued"; challenge: IssuedChallenge }
  | { status: "unavailable" };

/**
 * Write a pending challenge row and return the terms the client must sign.
 *
 * EVERY term is decided here, server-side. The client sends a wallet and a
 * surface and gets back an id, a window and a save budget it did not choose —
 * that is the difference between a challenge and a self-issued bearer token,
 * and it is why the Slice 0 payload (which let the client pick its own window)
 * is gone.
 */
export async function issueScoreWriteChallenge(
  supabase: SupabaseClient,
  wallet: string,
  surface: ScoreSaveSurface,
  now: number = Date.now(),
): Promise<IssueChallengeResult> {
  const issuedAtSeconds = Math.floor(now / 1000);
  const challenge: IssuedChallenge = {
    sessionId: createSessionId(),
    issuedAt: issuedAtSeconds,
    expiresAt: issuedAtSeconds + SCORE_SESSION_TTL_SECONDS,
    maxSaves: SCORE_SESSION_MAX_SAVES,
  };

  const { error } = await supabase.from("score_write_sessions").insert({
    session_id: challenge.sessionId,
    wallet: wallet.toLowerCase(),
    surface,
    token_hash: null,
    issued_at: new Date(challenge.issuedAt * 1000).toISOString(),
    expires_at: new Date(challenge.expiresAt * 1000).toISOString(),
    challenge_expires_at: new Date(
      (issuedAtSeconds + SCORE_SESSION_CHALLENGE_TTL_SECONDS) * 1000,
    ).toISOString(),
    max_saves: challenge.maxSaves,
    used_saves: 0,
  });

  if (error) {
    log.error("challenge_insert_failed", { code: error.code, message: error.message });
    return { status: "unavailable" };
  }

  return { status: "issued", challenge };
}

// ─────────────────────────────────────────────────────────────────
// Authorize
// ─────────────────────────────────────────────────────────────────

export type AuthorizeResult =
  | { status: "authorized"; token: string; expiresAt: number; maxSaves: number }
  | { status: "not_found" }
  | { status: "already_used" }
  | { status: "challenge_expired" }
  | { status: "revoked" }
  | { status: "mismatch" }
  | { status: "unavailable" };

/**
 * Turn a verified challenge into an active session.
 *
 * The caller must already have checked the SIGNATURE. What this adds is the
 * check the signature cannot give: that the terms in the signed message are
 * the ones the SERVER issued. A client can sign any text it likes, including
 * one with a generous `maxSaves` — the RPC matches on `session_id` and the
 * stored wallet/surface, so a fabricated message finds no row.
 */
export async function authorizeScoreWriteSession(
  supabase: SupabaseClient,
  sessionId: string,
  wallet: string,
  surface: ScoreSaveSurface,
): Promise<AuthorizeResult> {
  const token = createSessionToken();

  const { data, error } = await supabase.rpc("authorize_score_write_session", {
    p_session_id: sessionId,
    p_wallet: wallet.toLowerCase(),
    p_surface: surface,
    p_token_hash: hashSessionToken(token),
  });

  if (error || !data || typeof data !== "object") {
    log.error("authorize_rpc_failed", { code: error?.code, message: error?.message });
    return { status: "unavailable" };
  }

  const row = data as Record<string, unknown>;
  if (row.status === "authorized") {
    return {
      status: "authorized",
      token,
      expiresAt: Math.floor(Date.parse(String(row.expiresAt)) / 1000),
      maxSaves: Number(row.maxSaves),
    };
  }

  const known = ["not_found", "already_used", "challenge_expired", "revoked", "mismatch"];
  if (typeof row.status === "string" && known.includes(row.status)) {
    return { status: row.status as Exclude<AuthorizeResult["status"], "authorized"> };
  }
  return { status: "unavailable" };
}

// ─────────────────────────────────────────────────────────────────
// Consume
// ─────────────────────────────────────────────────────────────────

export type ConsumeResult =
  | {
      status: "consumed";
      wallet: string;
      surface: ScoreSaveSurface;
      usedSaves: number;
      maxSaves: number;
    }
  | { status: "not_found" }
  | { status: "expired" }
  | { status: "revoked" }
  | { status: "exhausted" }
  | { status: "unavailable" };

/**
 * Spend one save. Returns the wallet the session belongs to.
 *
 * Note what is NOT a parameter: a wallet. The identity comes out of the row,
 * so a token can only ever write to its own wallet — the property is
 * structural, not a validation someone could forget to call.
 *
 * Anything other than `consumed` must fail the request CLOSED. In particular
 * `unavailable` is not "let it through": an unreachable session store means no
 * budget accounting, and no save is urgent enough for that.
 */
export async function consumeScoreWriteSession(
  supabase: SupabaseClient,
  token: string,
): Promise<ConsumeResult> {
  const { data, error } = await supabase.rpc("consume_score_write_session", {
    p_token_hash: hashSessionToken(token),
  });

  if (error || !data || typeof data !== "object") {
    log.error("consume_rpc_failed", { code: error?.code, message: error?.message });
    return { status: "unavailable" };
  }

  const row = data as Record<string, unknown>;
  if (row.status === "consumed") {
    return {
      status: "consumed",
      wallet: String(row.wallet),
      surface: row.surface as ScoreSaveSurface,
      usedSaves: Number(row.usedSaves),
      maxSaves: Number(row.maxSaves),
    };
  }

  const known = ["not_found", "expired", "revoked", "exhausted"];
  if (typeof row.status === "string" && known.includes(row.status)) {
    return { status: row.status as Exclude<ConsumeResult["status"], "consumed"> };
  }
  return { status: "unavailable" };
}
