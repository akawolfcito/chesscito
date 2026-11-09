/**
 * SaveScore — surface identity and the server-side bounds on a written score.
 *
 * Audit: docs/product/2026-07-27-score-and-leaders-audit.md §R1, §R12.
 *
 * HISTORY (worth keeping, because the shape of this file is the argument)
 * ----------------------------------------------------------------------
 * Before Slice 0, `/api/scores/save` took `player` from the request body and
 * validated `score` only as "finite and > 0". A `curl` could write any score
 * for ANY wallet and take #1.
 *
 * Slice 0 fixed authorship by making every save carry its own EIP-191
 * signature. Slice 0.1 kept the property and moved the signature UP a level:
 * one signature now buys a bounded, revocable SESSION (see
 * `session-authorization.ts`) and individual saves ride a bearer token. The
 * per-save canonical message that used to live here is gone with it — a
 * signature per save meant a wallet prompt after nearly every exercise, and a
 * prompt players learn to dismiss reflexively is a security control that has
 * been turned into a training exercise for the opposite habit.
 *
 * What survives here is what was never about the signature: WHICH PRODUCT a
 * row belongs to, and WHAT VALUES the server will accept at all. Those bind
 * regardless of how the caller authenticated.
 *
 * WHY EIP-191 (personal_sign) AND NOT EIP-712 — still the governing decision
 * ------------------------------------------------------------------------
 *  - It is already proven on both wallets this app ships to: `useSignMessage`
 *    (EIP-191) is in production in `use-lite-welcome-gift-claim.ts`, verified
 *    server-side by `lib/server/welcome-pack.ts`, and `/dev/sign-probe`
 *    confirmed `personal_sign` on a real MiniPay device. Privy's embedded
 *    wallet is an EOA, so plain ECDSA recovery works there too.
 *  - EIP-712 needs a `verifyingContract` in its domain. This flow never
 *    touches a contract, so we would be inventing an address to satisfy the
 *    type — a domain that means nothing is worse than no domain.
 *  - The signed text is what the player SEES in the wallet prompt. A readable
 *    message naming the terms is a security property, not a cosmetic one:
 *    EIP-712 would render as an opaque struct in MiniPay.
 *
 * PURE and isomorphic: no viem, no Supabase, no `Date.now()`, no `window`.
 */

import { MAX_SUBMITTABLE_SCORE } from "@/lib/game/score";

// ─────────────────────────────────────────────────────────────────
// Surface
// ─────────────────────────────────────────────────────────────────

/** Which deployment produced this save. Learn and Play share one Supabase
 *  project (founder confirmed 2026-07-27), so without this the two products'
 *  rows are indistinguishable in `score_saves` — audit R12. */
export type ScoreSaveSurface = "learn" | "play";

export const SCORE_SAVE_SURFACES: readonly ScoreSaveSurface[] = ["learn", "play"];

export function isScoreSaveSurface(v: unknown): v is ScoreSaveSurface {
  return typeof v === "string" && (SCORE_SAVE_SURFACES as readonly string[]).includes(v);
}

// ─────────────────────────────────────────────────────────────────
// Bounds
// ─────────────────────────────────────────────────────────────────

/**
 * Server-side ceiling for a single level's score.
 *
 * Deliberately reuses `MAX_SUBMITTABLE_SCORE` — the SAME generous product
 * invariant the on-chain lane already validates against — instead of deriving
 * a tight bound from the live catalog. `lib/game/score.ts` documents why at
 * length: a tight ceiling silently locks out the best players the moment a
 * pool grows, and putting Supabase's merged catalog on the write path
 * reintroduces client/server disagreement. The constant is server-safe: it
 * resolves from the generated baseline catalog with no `window`, no network.
 *
 * This is a DoS/overflow guard, not an anti-cheat control. A real per-player
 * ceiling needs server-side progress, which is Slice 3.
 */
export const MAX_SCORE_PER_LEVEL = MAX_SUBMITTABLE_SCORE;

/** Upper bound for a single exercise's elapsed time (1 hour), mirroring the
 *  bound `/api/sign-score` already applies. */
export const MAX_SCORE_SAVE_TIME_MS = 3_600_000;

export const MIN_LEVEL_ID = 1;
export const MAX_LEVEL_ID = 6;

export type ScoreSaveBounds = {
  levelId: number;
  score: number;
  timeMs: number;
};

export type ScoreSaveBoundsError =
  | "invalid_level"
  | "invalid_score"
  | "score_out_of_range"
  | "invalid_time";

export type ScoreSaveBoundsValidation =
  | { ok: true; value: ScoreSaveBounds }
  | { ok: false; error: ScoreSaveBoundsError };

function isPositiveInt(v: unknown): v is number {
  return typeof v === "number" && Number.isSafeInteger(v) && v > 0;
}

/**
 * Validate the three numbers a save actually writes.
 *
 * Runs on EVERY save regardless of how the caller authenticated: a valid
 * session token authorizes *writing*, it does not authorize *any value*. This
 * is what keeps `score` inside the range the leaderboard aggregate can hold
 * (audit R13) and what makes a compromised token bounded rather than a way to
 * mint an arbitrary total.
 *
 * `Number.isSafeInteger` rejects NaN, Infinity, negatives and fractions in one
 * predicate — `typeof v === "number"` alone accepts all of them.
 */
export function validateScoreSaveBounds(input: {
  levelId: unknown;
  score: unknown;
  timeMs: unknown;
}): ScoreSaveBoundsValidation {
  const { levelId, score, timeMs } = input;

  if (
    !isPositiveInt(levelId) ||
    levelId < MIN_LEVEL_ID ||
    levelId > MAX_LEVEL_ID
  ) {
    return { ok: false, error: "invalid_level" };
  }

  if (!isPositiveInt(score)) {
    return { ok: false, error: "invalid_score" };
  }
  if (score > MAX_SCORE_PER_LEVEL) {
    return { ok: false, error: "score_out_of_range" };
  }

  if (!isPositiveInt(timeMs) || timeMs > MAX_SCORE_SAVE_TIME_MS) {
    return { ok: false, error: "invalid_time" };
  }

  return { ok: true, value: { levelId, score, timeMs } };
}
