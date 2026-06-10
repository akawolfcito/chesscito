/**
 * SaveScore off-chain — pure service helpers.
 *
 * Slice 2 of the SaveScore off-chain/Peones cluster (spec:
 * docs/specs/savescore-offchain-peones.md). Every export here is a pure
 * function with NO Supabase client, NO DB call, NO endpoint glue, NO UI
 * dependency, NO localStorage, NO Date.now()/Math.random(). The endpoint
 * (Slice 3) wires these inside the HTTP handler; the DB RPC
 * `save_basic_score` (Slice 1) is the atomic core. The helpers here know
 * nothing about transport or storage.
 *
 * Two contracts anchored here:
 *   1. The quota math (5 free saves per wallet, then 1 Peón). `freeUsed`
 *      is fed by the caller (counted server-side from `score_saves` per
 *      wallet); this function only does the arithmetic.
 *   2. The deterministic saveId derivation — the dedup + idempotency seed
 *      shared by the table UNIQUE and the `spend:save_game:` key.
 */

import type { PeonesSpendTarget } from "../peones/spend-service";

// ─────────────────────────────────────────────────────────────────
// Calibration constants
// ─────────────────────────────────────────────────────────────────

/** Free basic saves per wallet (lifetime, MVP). Mirrors the SQL
 *  constant `c_free_limit` in 20260609000000_score_saves_init.sql.
 *  Calibrable — change in lockstep with the migration. */
export const FREE_SCORE_SAVE_LIMIT = 5;

/** Peones cost per basic save beyond the free quota. Pinned to the
 *  server-trusted `save_game` cost by a lockstep test so the two can
 *  never drift. Mirrors the SQL constant `c_cost`. */
export const SCORE_SAVE_COST_PEONES: number = 1;

// ─────────────────────────────────────────────────────────────────
// Types (SDD)
// ─────────────────────────────────────────────────────────────────

/** Base flow is off-chain only. On-chain proof is a separate future lane. */
export type ScoreSaveMode = "free" | "peones";

/** Deterministic dedup / idempotency seed. `${player}:${levelId}:${gameId}`
 *  lowercased. NO tx_hash, NO timestamp, NO randomness. */
export type ScoreSaveId = string;

export type BasicScoreSaveRequest = {
  player: `0x${string}`;
  levelId: number;
  score: number;
  timeMs: number;
  gameId: string;
  saveId: ScoreSaveId;
};

/** Snapshot of where a wallet sits against the free quota. */
export type ScoreSaveQuota = {
  wallet: string;
  freeLimit: number;
  freeUsed: number;
  freeRemaining: number;
  requiresPeones: boolean;
  costPeones: number;
};

/** Discriminated result of POST /api/scores/save — the endpoint maps the
 *  `save_basic_score` jsonb onto this union. */
export type BasicScoreSaveResult =
  | { status: "saved"; mode: "free"; quota: ScoreSaveQuota }
  | { status: "saved"; mode: "peones"; spent: number; quota: ScoreSaveQuota }
  | { status: "duplicate"; quota: ScoreSaveQuota }
  | { status: "insufficient_peones"; required: number; balance: number; quota: ScoreSaveQuota }
  | { status: "invalid"; reason: string }
  | { status: "rate_limited"; retryAfterMs: number }
  | { status: "error"; reason: string };

// ─────────────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────────────

/** Clamp an externally-supplied count to a safe non-negative integer.
 *  Guards against NaN / negatives / fractional drift from the caller. */
function clampUsed(freeUsed: number): number {
  if (!Number.isFinite(freeUsed)) return 0;
  return Math.max(0, Math.trunc(freeUsed));
}

/**
 * Pure quota math. `freeUsed` is the per-wallet count of existing
 * `score_saves` rows (counted server-side). `proActive` is reserved for
 * a future PRO quota bump — it is intentionally ignored in MVP so the
 * signature is stable when that lands.
 */
export function computeScoreSaveQuota(
  wallet: string,
  freeUsed: number,
  proActive?: boolean,
): ScoreSaveQuota {
  // `proActive` is reserved for a future PRO quota bump; intentionally
  // unused in MVP. Reference it as a no-op to keep the param documented.
  void proActive;

  const used = clampUsed(freeUsed);
  const freeRemaining = Math.max(0, FREE_SCORE_SAVE_LIMIT - used);
  const requiresPeones = freeRemaining === 0;

  return {
    wallet: wallet.toLowerCase(),
    freeLimit: FREE_SCORE_SAVE_LIMIT,
    freeUsed: used,
    freeRemaining,
    requiresPeones,
    costPeones: requiresPeones ? SCORE_SAVE_COST_PEONES : 0,
  };
}

/**
 * Deterministic saveId. Includes `levelId` so two levels of the same
 * game never collide. Lowercased so the value matches the table's
 * lowercase wallet + the `spend:save_game:` idempotency key built from
 * it. Idempotent: identical inputs always yield byte-identical output.
 */
export function deriveScoreSaveId(
  player: string,
  levelId: number,
  gameId: string,
): ScoreSaveId {
  return `${player}:${levelId}:${gameId}`.toLowerCase();
}

// ─────────────────────────────────────────────────────────────────
// FUTURE LANE — placeholder types only (NO behavior, NO impl)
// ─────────────────────────────────────────────────────────────────
//
// On-chain Leaderboard Proof / Trophy. Lives conceptually under
// Leaderboard, NOT gameplay. Reuses the RETAINED /api/sign-score +
// submitScoreSigned + Scoreboard helpers as its base. Pricing / contract
// / NFT undecided (audit §6). Declared here only so the SDD boundary is
// closed cleanly; nothing consumes these yet.

export type LeaderboardProofKindFuture =
  | "weekly_rank"
  | "top10_weekly"
  | "top3_weekly"
  | "immortalize_game";

export type LeaderboardProofRequestFuture = {
  player: `0x${string}`;
  kind: LeaderboardProofKindFuture;
};

// Compile-time guard: `save_game` must remain a valid spend target so the
// idempotency key `spend:save_game:{saveId}` keeps routing correctly.
const _SAVE_GAME_TARGET: PeonesSpendTarget = "save_game";
void _SAVE_GAME_TARGET;
