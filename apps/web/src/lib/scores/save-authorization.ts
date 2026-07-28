/**
 * SaveScore — canonical signed authorization payload (Slice 0).
 *
 * Audit: docs/product/2026-07-27-score-and-leaders-audit.md §R1.
 *
 * WHY THIS EXISTS
 * ---------------
 * Before this module `/api/scores/save` took `player` from the request body.
 * Nothing tied that address to the caller: a `curl` could write any score for
 * ANY wallet, and `enforceOrigin` waved through any request that omitted both
 * `Origin` and `Referer`. The write path had no notion of authorship.
 *
 * Now the address is RECOVERED from an EIP-191 signature over the canonical
 * message built here. There is no `player` field in the request body at all —
 * a redundant field is a field someone will eventually trust by accident. The
 * body carries `{ message, signature }` and nothing else; every other value is
 * parsed back out of the signed text.
 *
 * WHY EIP-191 (personal_sign) AND NOT EIP-712
 * -------------------------------------------
 *  - It is already proven on both wallets this app ships to: `useSignMessage`
 *    (EIP-191) is in production in `use-lite-welcome-gift-claim.ts`, verified
 *    server-side by `lib/server/welcome-pack.ts`, and `/dev/sign-probe`
 *    confirmed `personal_sign` on a real MiniPay device. Privy's embedded
 *    wallet is an EOA, so plain ECDSA recovery works there too.
 *  - EIP-712 needs a `verifyingContract` in its domain. This save never
 *    touches a contract, so we would be inventing an address to satisfy the
 *    type — a domain that means nothing is worse than no domain.
 *  - The signed text is what the player SEES in the wallet prompt. A readable
 *    message that names the score and the surface is a security property, not
 *    a cosmetic one: EIP-712 would render as an opaque struct in MiniPay.
 *
 * Replay resistance does NOT come from the message format. It comes from
 * `expiresAt` (short window) plus a one-shot nonce persisted in Postgres —
 * see `lib/server/score-save-nonce.ts`. Process memory would reset on every
 * redeploy, which is not protection.
 *
 * This module is PURE and isomorphic: no viem, no Supabase, no `Date.now()`,
 * no `window`. The client builds the message with it; the server parses and
 * validates with the same code, so the two can never disagree about format.
 */

import { MAX_SUBMITTABLE_SCORE } from "@/lib/game/score";

// ─────────────────────────────────────────────────────────────────
// Types (SDD — the contract before the logic)
// ─────────────────────────────────────────────────────────────────

/** Which deployment produced this save. Learn and Play share one Supabase
 *  project (founder confirmed 2026-07-27), so without this the two products'
 *  rows are indistinguishable in `score_saves` — audit R12. */
export type ScoreSaveSurface = "learn" | "play";

export const SCORE_SAVE_SURFACES: readonly ScoreSaveSurface[] = ["learn", "play"];

export function isScoreSaveSurface(v: unknown): v is ScoreSaveSurface {
  return typeof v === "string" && (SCORE_SAVE_SURFACES as readonly string[]).includes(v);
}

/** Everything the player authorizes with one signature. */
export type ScoreSaveClaim = {
  chainId: number;
  /** Lowercased. Case is normalized at parse time so a checksummed and a
   *  lowercased message can never be treated as two different claims. */
  player: string;
  surface: ScoreSaveSurface;
  levelId: number;
  score: number;
  timeMs: number;
  /** Unix SECONDS (not ms) — the message is read by humans in a wallet
   *  prompt, and ms timestamps are noise there. */
  issuedAt: number;
  expiresAt: number;
  /** One-shot, client-generated, 32 hex chars. Uniqueness is enforced by the
   *  DB primary key, not by trusting the client's randomness. */
  nonce: string;
};

export type ScoreSaveClaimError =
  | "invalid_message"
  | "invalid_chain"
  | "invalid_surface"
  | "surface_mismatch"
  | "invalid_level"
  | "invalid_score"
  | "score_out_of_range"
  | "invalid_time"
  | "invalid_window"
  | "expired"
  | "not_yet_valid";

export type ScoreSaveClaimValidation =
  | { ok: true; claim: ScoreSaveClaim }
  | { ok: false; error: ScoreSaveClaimError };

// ─────────────────────────────────────────────────────────────────
// Calibration
// ─────────────────────────────────────────────────────────────────

/** Bumping this invalidates every in-flight signature by design. The version
 *  lives in the first line of the message, so an old client's payload fails
 *  the regex rather than being silently reinterpreted. */
export const SCORE_SAVE_MESSAGE_VERSION = "v1";

const MESSAGE_HEADER = `Chesscito Score Save ${SCORE_SAVE_MESSAGE_VERSION}`;

/** Longest authorization window we accept, in seconds. A signature is a
 *  bearer token for exactly one save; 5 minutes covers a slow mobile network
 *  and a distracted player without leaving a useful replay window. */
export const MAX_SCORE_SAVE_WINDOW_SECONDS = 5 * 60;

/** Tolerance for a device clock ahead of the server. Mobile clocks drift;
 *  rejecting a 3-second skew would produce support tickets, not security. */
export const SCORE_SAVE_CLOCK_SKEW_SECONDS = 90;

/** Server-side ceiling for a single level's score.
 *
 *  Deliberately reuses `MAX_SUBMITTABLE_SCORE` — the SAME generous product
 *  invariant the on-chain lane already validates against — instead of deriving
 *  a tight bound from the live catalog. `lib/game/score.ts` documents why at
 *  length: a tight ceiling silently locks out the best players the moment a
 *  pool grows, and putting Supabase's merged catalog on the write path
 *  reintroduces client/server disagreement. The constant is server-safe: it
 *  resolves from the generated baseline catalog with no `window`, no network.
 *
 *  This is a DoS/overflow guard, not an anti-cheat control. Deriving a real
 *  per-player ceiling needs server-side progress, which is Slice 3. */
export const MAX_SCORE_PER_LEVEL = MAX_SUBMITTABLE_SCORE;

/** Upper bound for a single exercise's elapsed time (1 hour), mirroring the
 *  bound `/api/sign-score` already applies. */
export const MAX_SCORE_SAVE_TIME_MS = 3_600_000;

export const MIN_LEVEL_ID = 1;
export const MAX_LEVEL_ID = 6;

/** 32 lowercase hex chars = 128 bits. Enough that an accidental collision
 *  between two honest clients is not a thing that happens. */
const NONCE_RE = /^[0-9a-f]{32}$/;

export function isScoreSaveNonce(v: unknown): v is string {
  return typeof v === "string" && NONCE_RE.test(v);
}

// ─────────────────────────────────────────────────────────────────
// Message build / parse
// ─────────────────────────────────────────────────────────────────

/**
 * The canonical text the wallet signs. Field order is FIXED and part of the
 * contract: the parser below is anchored, so a reordered message does not
 * verify. Every field that changes the meaning of the write is in here —
 * chain, author, surface, level, score, time, validity window, nonce — because
 * anything outside the signature is something an attacker can rewrite in
 * flight.
 */
export function buildScoreSaveMessage(claim: ScoreSaveClaim): string {
  return [
    MESSAGE_HEADER,
    `chainId: ${claim.chainId}`,
    `player: ${claim.player.toLowerCase()}`,
    `surface: ${claim.surface}`,
    `levelId: ${claim.levelId}`,
    `score: ${claim.score}`,
    `timeMs: ${claim.timeMs}`,
    `issuedAt: ${claim.issuedAt}`,
    `expiresAt: ${claim.expiresAt}`,
    `nonce: ${claim.nonce}`,
  ].join("\n");
}

/** Anchored, whitespace-exact. Anything that is not byte-for-byte the shape
 *  `buildScoreSaveMessage` emits is rejected — no lenient parsing, because a
 *  lenient parser is a second, undocumented message format. */
const MESSAGE_RE = new RegExp(
  "^" +
    `Chesscito Score Save ${SCORE_SAVE_MESSAGE_VERSION}` +
    "\\nchainId: (\\d{1,12})" +
    "\\nplayer: (0x[0-9a-fA-F]{40})" +
    "\\nsurface: ([a-z]{1,16})" +
    "\\nlevelId: (\\d{1,2})" +
    "\\nscore: (\\d{1,12})" +
    "\\ntimeMs: (\\d{1,12})" +
    "\\nissuedAt: (\\d{1,12})" +
    "\\nexpiresAt: (\\d{1,12})" +
    "\\nnonce: ([0-9a-f]{32})" +
    "$",
);

/**
 * Parse the signed text back into a claim. Returns null on ANY deviation.
 *
 * Note the regex only admits digits for the numeric fields: `NaN`, `Infinity`,
 * `-1`, `1e9`, `1.5` and `0x10` cannot reach the numeric validation below,
 * they fail here. That is deliberate — `Number()` accepts far too much.
 */
export function parseScoreSaveMessage(message: unknown): ScoreSaveClaim | null {
  if (typeof message !== "string") return null;
  const match = MESSAGE_RE.exec(message);
  if (!match) return null;

  const [
    ,
    chainId,
    player,
    surface,
    levelId,
    score,
    timeMs,
    issuedAt,
    expiresAt,
    nonce,
  ] = match;

  if (!isScoreSaveSurface(surface)) return null;

  return {
    chainId: Number(chainId),
    player: player.toLowerCase(),
    surface,
    levelId: Number(levelId),
    score: Number(score),
    timeMs: Number(timeMs),
    issuedAt: Number(issuedAt),
    expiresAt: Number(expiresAt),
    nonce,
  };
}

// ─────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────

function isPositiveInt(v: number): boolean {
  return Number.isSafeInteger(v) && v > 0;
}

export type ValidateScoreSaveOptions = {
  /** The surface this DEPLOYMENT is. A payload claiming the other surface is
   *  rejected: the client picks what it signs, so the client alone must never
   *  decide which product a row belongs to. */
  expectedSurface: ScoreSaveSurface;
  /** Configured chain for this deployment, or null when unset — in which case
   *  the chain is only shape-checked. */
  expectedChainId: number | null;
  /** Unix SECONDS. Injected so tests pin the clock. */
  nowSeconds: number;
};

/**
 * Full validation of a parsed claim, independent of the signature. The caller
 * (`lib/server/score-save-verification.ts`) runs this BEFORE the ECDSA
 * recovery so a malformed payload never costs a crypto operation.
 *
 * Order matters only for error reporting: every check is independent.
 */
export function validateScoreSaveClaim(
  claim: ScoreSaveClaim,
  opts: ValidateScoreSaveOptions,
): ScoreSaveClaimValidation {
  const { expectedSurface, expectedChainId, nowSeconds } = opts;

  if (!isPositiveInt(claim.chainId)) {
    return { ok: false, error: "invalid_chain" };
  }
  if (expectedChainId !== null && claim.chainId !== expectedChainId) {
    return { ok: false, error: "invalid_chain" };
  }

  if (!isScoreSaveSurface(claim.surface)) {
    return { ok: false, error: "invalid_surface" };
  }
  if (claim.surface !== expectedSurface) {
    return { ok: false, error: "surface_mismatch" };
  }

  if (
    !Number.isSafeInteger(claim.levelId) ||
    claim.levelId < MIN_LEVEL_ID ||
    claim.levelId > MAX_LEVEL_ID
  ) {
    return { ok: false, error: "invalid_level" };
  }

  if (!isPositiveInt(claim.score)) {
    return { ok: false, error: "invalid_score" };
  }
  if (claim.score > MAX_SCORE_PER_LEVEL) {
    return { ok: false, error: "score_out_of_range" };
  }

  if (!isPositiveInt(claim.timeMs) || claim.timeMs > MAX_SCORE_SAVE_TIME_MS) {
    return { ok: false, error: "invalid_time" };
  }

  if (!isPositiveInt(claim.issuedAt) || !isPositiveInt(claim.expiresAt)) {
    return { ok: false, error: "invalid_window" };
  }
  if (claim.expiresAt <= claim.issuedAt) {
    return { ok: false, error: "invalid_window" };
  }
  // A client cannot mint itself a long-lived bearer token by widening its own
  // window: the DURATION is capped server-side, not just the end date.
  if (claim.expiresAt - claim.issuedAt > MAX_SCORE_SAVE_WINDOW_SECONDS) {
    return { ok: false, error: "invalid_window" };
  }
  if (claim.issuedAt - nowSeconds > SCORE_SAVE_CLOCK_SKEW_SECONDS) {
    return { ok: false, error: "not_yet_valid" };
  }
  if (nowSeconds > claim.expiresAt + SCORE_SAVE_CLOCK_SKEW_SECONDS) {
    return { ok: false, error: "expired" };
  }

  if (!isScoreSaveNonce(claim.nonce)) {
    return { ok: false, error: "invalid_message" };
  }

  return { ok: true, claim };
}
