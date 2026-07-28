"use client";

/**
 * Score write session — client cache and just-in-time authorization.
 *
 * Audit: docs/product/2026-07-27-score-and-leaders-audit.md §10.
 *
 *   first puntuable save  → challenge → ONE signature → token
 *   every save after that → silent
 *
 * WHY THE TOKEN LIVES IN MODULE MEMORY AND NOT IN STORAGE
 * -------------------------------------------------------
 * It is a bearer credential. Putting it in localStorage/sessionStorage widens
 * the blast radius to anything that can read the origin's storage (an XSS, a
 * shared device, a synced browser profile) in exchange for saving one wallet
 * prompt after a page reload. One prompt per two hours is a price worth
 * paying; a persisted write capability is not.
 *
 * The cache is keyed by `(wallet, surface)`, which is what makes invalidation
 * automatic rather than something a caller must remember:
 *   - wallet changes  → key misses → new authorization
 *   - Disconnect      → no address → `clearScoreSession()` and no key at all
 *   - surface changes → key misses (a build only has one, but a token minted
 *                       on the other product must never be reused)
 *   - expiry          → checked against the cached `expiresAt` before use
 *   - server says the session is dead → dropped on the spot
 *
 * NEVER prompts on mount, on Hub open, or before an exercise is completed —
 * only on the first save that is actually going to be written.
 */

import type { ScoreSaveSurface } from "./save-authorization";

export type SignMessageFn = (args: { message: string }) => Promise<string>;

export type ScoreSession = {
  token: string;
  wallet: string;
  surface: ScoreSaveSurface;
  /** Unix SECONDS, as issued by the server. */
  expiresAt: number;
  maxSaves: number;
};

export type ScoreSessionError =
  | "no_wallet"
  | "challenge_failed"
  | "signature_rejected"
  | "authorize_failed"
  | "network";

export type ScoreSessionResult =
  | { ok: true; session: ScoreSession }
  | { ok: false; error: ScoreSessionError };

/**
 * Refresh a token this many seconds BEFORE it actually expires.
 *
 * Without a margin a token that passes the client check can still expire in
 * flight, producing a 401 the player experiences as a random failed save. 60s
 * comfortably covers a slow mobile round trip.
 */
const EXPIRY_MARGIN_SECONDS = 60;

let cached: ScoreSession | null = null;
/** In-flight authorization, so two saves racing on the same tick produce ONE
 *  wallet prompt rather than two. This is the difference between "just in
 *  time" and "twice, confusingly". */
let inFlight: Promise<ScoreSessionResult> | null = null;

function cacheKeyMatches(
  session: ScoreSession | null,
  wallet: string,
  surface: ScoreSaveSurface,
  nowSeconds: number,
): session is ScoreSession {
  if (!session) return false;
  if (session.wallet !== wallet.toLowerCase()) return false;
  if (session.surface !== surface) return false;
  return session.expiresAt - EXPIRY_MARGIN_SECONDS > nowSeconds;
}

/** Drop the cached session. Called on Disconnect, and whenever the server
 *  reports the session is no longer usable. */
export function clearScoreSession(): void {
  cached = null;
  inFlight = null;
}

/** Test seam + the "server rejected our token" path: returns what is cached
 *  without ever minting anything. */
export function peekScoreSession(): ScoreSession | null {
  return cached;
}

export type EnsureScoreSessionInput = {
  wallet: string;
  surface: ScoreSaveSurface;
  signMessage: SignMessageFn;
  fetchImpl?: typeof fetch;
  now?: number;
  /** Force a fresh authorization even if a token is cached. Used exactly once
   *  after the server rejects a token, never in a loop. */
  forceRefresh?: boolean;
};

/**
 * Return a usable session, minting one (with a single wallet prompt) only if
 * the cache cannot serve the request.
 */
export async function ensureScoreSession(
  input: EnsureScoreSessionInput,
): Promise<ScoreSessionResult> {
  const {
    wallet,
    surface,
    signMessage,
    fetchImpl = fetch,
    now = Date.now(),
    forceRefresh = false,
  } = input;

  if (!wallet) return { ok: false, error: "no_wallet" };

  const nowSeconds = Math.floor(now / 1000);

  if (forceRefresh) {
    cached = null;
  } else if (cacheKeyMatches(cached, wallet, surface, nowSeconds)) {
    return { ok: true, session: cached };
  }

  // Coalesce concurrent callers onto one prompt.
  if (inFlight) return inFlight;

  inFlight = authorize(wallet, surface, signMessage, fetchImpl).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function authorize(
  wallet: string,
  surface: ScoreSaveSurface,
  signMessage: SignMessageFn,
  fetchImpl: typeof fetch,
): Promise<ScoreSessionResult> {
  // 1. Ask the server for terms. The client proposes nothing but its wallet.
  let challenge: { message?: unknown; expiresAt?: unknown; maxSaves?: unknown };
  try {
    const res = await fetchImpl("/api/scores/session/challenge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wallet }),
    });
    if (!res.ok) return { ok: false, error: "challenge_failed" };
    challenge = await res.json();
  } catch {
    return { ok: false, error: "network" };
  }

  if (typeof challenge.message !== "string") {
    return { ok: false, error: "challenge_failed" };
  }

  // 2. The one prompt. Everything the player is agreeing to is readable in it.
  let signature: string;
  try {
    signature = await signMessage({ message: challenge.message });
  } catch {
    return { ok: false, error: "signature_rejected" };
  }

  // 3. Trade the signature for the token.
  let payload: { token?: unknown; expiresAt?: unknown; maxSaves?: unknown };
  try {
    const res = await fetchImpl("/api/scores/session/authorize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: challenge.message, signature }),
    });
    if (!res.ok) return { ok: false, error: "authorize_failed" };
    payload = await res.json();
  } catch {
    return { ok: false, error: "network" };
  }

  if (
    typeof payload.token !== "string" ||
    typeof payload.expiresAt !== "number" ||
    typeof payload.maxSaves !== "number"
  ) {
    return { ok: false, error: "authorize_failed" };
  }

  cached = {
    token: payload.token,
    wallet: wallet.toLowerCase(),
    surface,
    expiresAt: payload.expiresAt,
    maxSaves: payload.maxSaves,
  };
  return { ok: true, session: cached };
}
