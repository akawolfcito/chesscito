/**
 * Score write sessions — canonical challenge payload (Slice 0.1).
 *
 * Audit: docs/product/2026-07-27-score-and-leaders-audit.md §10.
 *
 * WHY THIS REPLACES THE PER-SAVE SIGNATURE
 * ----------------------------------------
 * Slice 0 made every save carry its own EIP-191 signature. That closed
 * impersonation (audit R1) but priced it badly: the off-chain save is a silent
 * `useEffect` that fires on every star improvement, so a signature per save is
 * a wallet prompt after nearly every exercise. A security control the player
 * learns to dismiss reflexively is worse than no control — it trains the habit
 * we depend on for the on-chain lane.
 *
 * So the signature now buys a SESSION instead of a row:
 *
 *   one EIP-191 signature → one server-issued session → N silent saves
 *
 * The authorship property is unchanged. What changes is its granularity: the
 * wallet proves possession once, and the server issues a bearer token scoped
 * to exactly that wallet, that surface, a short window, and a bounded number
 * of writes. A stolen token is worth at most `maxSaves` rows on one wallet for
 * up to `expiresAt` — and it is revocable, which a signature never was.
 *
 * WHAT THE SERVER OWNS
 * --------------------
 * `sessionId`, `issuedAt`, `expiresAt` and `maxSaves` are ALL server-issued.
 * The client never proposes its own limits; it signs terms it was handed. That
 * is the difference between a challenge and a self-issued bearer token, and it
 * is why the per-save payload's client-chosen window (Slice 0) is gone.
 *
 * Still EIP-191, still the same two wallets — see `save-authorization.ts` for
 * the full rationale on why not EIP-712.
 *
 * PURE and isomorphic: no viem, no Supabase, no `Date.now()`, no `window`.
 */

import type { ScoreSaveSurface } from "@/lib/scores/save-authorization";

// ─────────────────────────────────────────────────────────────────
// Types (SDD)
// ─────────────────────────────────────────────────────────────────

export type ScoreSessionChallenge = {
  chainId: number;
  /** Lowercased at parse time so a checksummed message is not a second claim. */
  wallet: string;
  surface: ScoreSaveSurface;
  /** Server-issued, 32 hex chars. The client cannot pick it. */
  sessionId: string;
  /** Unix SECONDS — the message is read by a human in a wallet prompt. */
  issuedAt: number;
  expiresAt: number;
  maxSaves: number;
};

export type ScoreSessionClaimError =
  | "invalid_message"
  | "invalid_chain"
  | "invalid_surface"
  | "surface_mismatch"
  | "invalid_window"
  | "invalid_max_saves"
  | "expired";

export type ScoreSessionValidation =
  | { ok: true; challenge: ScoreSessionChallenge }
  | { ok: false; error: ScoreSessionClaimError };

// ─────────────────────────────────────────────────────────────────
// Server-side policy (centralised on purpose)
// ─────────────────────────────────────────────────────────────────

export const SCORE_SESSION_MESSAGE_VERSION = "v1";

const MESSAGE_HEADER = `Chesscito Score Session ${SCORE_SESSION_MESSAGE_VERSION}`;

/**
 * How long a session stays usable. 2 hours.
 *
 * Sized against the actual play session, not against a security ideal. The
 * daily quota is 10 exercises (`SESSION_EXERCISE_LIMIT`), which a player
 * finishes well inside two hours; anything shorter would re-prompt mid-session,
 * which is the exact failure this slice exists to remove. Anything much longer
 * turns the token into a de-facto standing credential on a shared device.
 */
export const SCORE_SESSION_TTL_SECONDS = 2 * 60 * 60;

/**
 * How many saves one signature authorizes. 25.
 *
 * Comfortably above a maxed-out day — 10 free exercises plus 2 paid packs of 5
 * is 15 (`HARD_MAX_EXTRAS`), and a save fires per *improvement*, not per
 * exercise, so a player who re-plays for stars generates a few more. 25 covers
 * that with margin while keeping a leaked token bounded to a nuisance rather
 * than an unbounded write capability.
 */
export const SCORE_SESSION_MAX_SAVES = 25;

/**
 * How long the player has to sign the challenge before it goes stale. 3 min.
 *
 * This is NOT in the signed message: it is server policy about how fresh a
 * signature must be, not a term the player agrees to. Long enough to read a
 * MiniPay prompt without rushing, short enough that a challenge captured in
 * transit is useless by the time it is replayed.
 */
export const SCORE_SESSION_CHALLENGE_TTL_SECONDS = 3 * 60;

/** Tolerance for a device clock ahead of the server. Mobile clocks drift. */
export const SCORE_SESSION_CLOCK_SKEW_SECONDS = 90;

/** 32 lowercase hex chars = 128 bits, for both sessionId and the raw token. */
const HEX32_RE = /^[0-9a-f]{32}$/;

export function isScoreSessionId(v: unknown): v is string {
  return typeof v === "string" && HEX32_RE.test(v);
}

// ─────────────────────────────────────────────────────────────────
// Message build / parse
// ─────────────────────────────────────────────────────────────────

/**
 * The canonical text the wallet signs. Field order is FIXED and part of the
 * contract — the parser below is anchored, so a reordered message does not
 * verify.
 *
 * Every term the session grants is named here: which chain, which wallet,
 * which product, how long, and how many writes. The player is not authorizing
 * "a save", they are authorizing a bounded capability, and the prompt has to
 * say so.
 */
export function buildScoreSessionMessage(c: ScoreSessionChallenge): string {
  return [
    MESSAGE_HEADER,
    `chainId: ${c.chainId}`,
    `wallet: ${c.wallet.toLowerCase()}`,
    `surface: ${c.surface}`,
    `sessionId: ${c.sessionId}`,
    `issuedAt: ${c.issuedAt}`,
    `expiresAt: ${c.expiresAt}`,
    `maxSaves: ${c.maxSaves}`,
  ].join("\n");
}

const MESSAGE_RE = new RegExp(
  "^" +
    `Chesscito Score Session ${SCORE_SESSION_MESSAGE_VERSION}` +
    "\\nchainId: (\\d{1,12})" +
    "\\nwallet: (0x[0-9a-fA-F]{40})" +
    "\\nsurface: ([a-z]{1,16})" +
    "\\nsessionId: ([0-9a-f]{32})" +
    "\\nissuedAt: (\\d{1,12})" +
    "\\nexpiresAt: (\\d{1,12})" +
    "\\nmaxSaves: (\\d{1,6})" +
    "$",
);

/** Parse the signed text back. Returns null on ANY deviation — the regex only
 *  admits digits, so NaN / Infinity / -1 / 1e9 / 0x10 never reach validation. */
export function parseScoreSessionMessage(
  message: unknown,
): ScoreSessionChallenge | null {
  if (typeof message !== "string") return null;
  const match = MESSAGE_RE.exec(message);
  if (!match) return null;

  const [, chainId, wallet, surface, sessionId, issuedAt, expiresAt, maxSaves] = match;
  if (surface !== "learn" && surface !== "play") return null;

  return {
    chainId: Number(chainId),
    wallet: wallet.toLowerCase(),
    surface,
    sessionId,
    issuedAt: Number(issuedAt),
    expiresAt: Number(expiresAt),
    maxSaves: Number(maxSaves),
  };
}

// ─────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────

function isPositiveInt(v: number): boolean {
  return Number.isSafeInteger(v) && v > 0;
}

export type ValidateScoreSessionOptions = {
  expectedSurface: ScoreSaveSurface;
  expectedChainId: number | null;
  nowSeconds: number;
};

/**
 * Shape and policy validation of a parsed challenge, independent of the
 * signature and of the stored row.
 *
 * NOTE this does NOT prove the terms are the ones the server issued — a client
 * could hand back a message it made up with a generous `maxSaves`. That is
 * caught in the store, which looks the `sessionId` up and compares against the
 * row it wrote. Both checks are needed: this one is cheap and runs before the
 * ECDSA recovery, the store's is authoritative.
 */
export function validateScoreSessionChallenge(
  c: ScoreSessionChallenge,
  opts: ValidateScoreSessionOptions,
): ScoreSessionValidation {
  const { expectedSurface, expectedChainId, nowSeconds } = opts;

  if (!isPositiveInt(c.chainId)) return { ok: false, error: "invalid_chain" };
  if (expectedChainId !== null && c.chainId !== expectedChainId) {
    return { ok: false, error: "invalid_chain" };
  }

  if (c.surface !== "learn" && c.surface !== "play") {
    return { ok: false, error: "invalid_surface" };
  }
  if (c.surface !== expectedSurface) {
    return { ok: false, error: "surface_mismatch" };
  }

  if (!isScoreSessionId(c.sessionId)) return { ok: false, error: "invalid_message" };

  if (!isPositiveInt(c.issuedAt) || !isPositiveInt(c.expiresAt)) {
    return { ok: false, error: "invalid_window" };
  }
  if (c.expiresAt <= c.issuedAt) return { ok: false, error: "invalid_window" };
  if (c.expiresAt - c.issuedAt > SCORE_SESSION_TTL_SECONDS) {
    return { ok: false, error: "invalid_window" };
  }
  if (nowSeconds > c.expiresAt + SCORE_SESSION_CLOCK_SKEW_SECONDS) {
    return { ok: false, error: "expired" };
  }

  if (!isPositiveInt(c.maxSaves) || c.maxSaves > SCORE_SESSION_MAX_SAVES) {
    return { ok: false, error: "invalid_max_saves" };
  }

  return { ok: true, challenge: c };
}
