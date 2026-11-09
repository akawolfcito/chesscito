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

// ─────────────────────────────────────────────────────────────────
// Calibration constants
// ─────────────────────────────────────────────────────────────────

/** Free basic saves per wallet (lifetime, MVP). Mirrors the SQL
 *  constant `c_free_limit`. Economy recalibration 2026-06-10: 5 → 3
 *  (tighter sink). Lockstep with the latest CREATE OR REPLACE of
 *  `save_basic_score` (20260610020000_savescore_quota_recalibration.sql). */
export const FREE_SCORE_SAVE_LIMIT = 3;

/** Historical Peones cost per basic save beyond the free quota.
 *  NEVER CHARGED since 2026-07-08: basic saves are unconditionally free
 *  (migration 20260708120000_savescore_always_free.sql) and Economy V1
 *  retired the `save_game` spend target entirely. Kept because the
 *  quota arithmetic below still reports a `costPeones` field to old
 *  callers; the value it reports is 0. */
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

/**
 * What the server recorded about ONE completed attempt (Slice 3, D12).
 *
 * `starsEarned` is server-computed and `null` is not "unknown by accident": a
 * starless bucket awards none, an ungraded legacy bundle sent nothing to grade.
 * `replayed` true means the row already existed — the request cost zero budget
 * and every field here came out of storage.
 */
export type AttemptOutcome = {
  attemptId: string;
  attemptIndex: number;
  replayed: boolean;
  starsEarned: number | null;
  gradeStatus: "graded" | "starless" | "ungraded";
};

/** Discriminated result of POST /api/scores/save — the endpoint maps the
 *  `save_score_attempt` jsonb onto this union.
 *
 *  `attempt` is OPTIONAL on purpose. It is always present from the live
 *  endpoint, but the field is additive: a client that ignores it behaves
 *  exactly as before, and the older constructors of this union (the peones
 *  branches, dead since 2026-07-08) never carried one. */
export type BasicScoreSaveResult =
  | { status: "saved"; mode: "free"; quota: ScoreSaveQuota; attempt?: AttemptOutcome }
  | { status: "saved"; mode: "peones"; spent: number; quota: ScoreSaveQuota }
  | { status: "duplicate"; quota: ScoreSaveQuota; attempt?: AttemptOutcome }
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
 * a future PRO quota bump — it is intentionally ignored so the signature
 * is stable when that lands.
 *
 * MiniPay Delivery Lote 2 (2026-07-08): off-chain save is now ALWAYS FREE.
 * Persisting a basic score/progress never costs Peones and works at a 0
 * balance, matching the always-free `save_basic_score` RPC
 * (20260708120000_savescore_always_free.sql). So `requiresPeones` is always
 * `false` and `costPeones` is always `0`, regardless of `freeUsed`. The
 * `freeUsed`/`freeRemaining` fields remain as informational counters only —
 * they no longer gate a paywall and are no longer surfaced in the UI.
 */
export function computeScoreSaveQuota(
  wallet: string,
  freeUsed: number,
  proActive?: boolean,
): ScoreSaveQuota {
  // `proActive` is reserved for a future PRO quota bump; intentionally
  // unused. Reference it as a no-op to keep the param documented.
  void proActive;

  const used = clampUsed(freeUsed);
  const freeRemaining = Math.max(0, FREE_SCORE_SAVE_LIMIT - used);

  return {
    wallet: wallet.toLowerCase(),
    freeLimit: FREE_SCORE_SAVE_LIMIT,
    freeUsed: used,
    freeRemaining,
    // Always free: no paywall, no sink. See RPC always-free migration.
    requiresPeones: false,
    costPeones: 0,
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

// The compile-time guard pinning `save_game` as a valid spend target was
// removed in Economy V1 (2026-07-21). It guarded an idempotency key that
// nothing builds any more: basic saves became unconditionally free on
// 2026-07-08 (migration 20260708120000_savescore_always_free.sql), and
// the sink was retired from PEONES_SPEND_TARGETS in the same commit that
// deleted this guard. Re-adding the target is what a paid save would
// need — not this line.
