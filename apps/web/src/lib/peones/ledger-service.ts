/**
 * Peones ledger — pure service helpers.
 *
 * Sprint 3 commit B of Training Economy Alpha 2026-06-07. Every export
 * here is a pure function with NO Supabase client, NO DB call, NO
 * endpoint glue, NO UI dependency, NO localStorage. The earn endpoint
 * (commit D) and the spend endpoint (Sprint 4) wire these helpers
 * inside the HTTP handler — the helpers themselves know nothing about
 * the transport.
 *
 * Two correctness contracts the helpers anchor:
 *  1. Balance is ALWAYS derived (never a mutable column).
 *  2. Daily cap is enforced by `applyDailyCap` BEFORE the insert, so
 *     the endpoint can decide truncate vs reject without holding a
 *     SQL lock open.
 *
 * The idempotency-key builders are the single source of truth for the
 * per-source key format documented in calibration §9. The unique
 * index on `peones_ledger.idempotency_key` is the DB-level twin.
 */

import {
  PEONES_DAILY_CAP_SOURCES,
  type PeonesLedgerSource,
  type PeonesLedgerRow,
} from "./types";

// ─────────────────────────────────────────────────────────────────
// Wallet
// ─────────────────────────────────────────────────────────────────

const WALLET_REGEX = /^0x[0-9a-fA-F]{40}$/;

/**
 * Normalises and validates an EVM wallet address. Returns the
 * lowercase, 0x-prefixed, 40-hex form ready for SQL writes. Throws
 * `Error("invalid_wallet")` on malformed input — the calibration
 * R9 mitigation lives here: every write/read path through the
 * ledger service goes through this helper, so mixed-case drift
 * cannot reach the DB.
 */
export function normalizeWallet(wallet: string): string {
  if (typeof wallet !== "string" || !WALLET_REGEX.test(wallet)) {
    throw new Error("invalid_wallet");
  }
  return wallet.toLowerCase();
}

// ─────────────────────────────────────────────────────────────────
// Balance
// ─────────────────────────────────────────────────────────────────

/** Minimal shape consumed by `computeLedgerBalance`. Accepts any
 *  superset of these fields so callers can pass full rows or just
 *  the columns they have. `pro_bypass` is optional because callers
 *  that only ever hold earn rows have no such column to pass; absent
 *  is read as `false` (a normal, balance-reducing spend). */
export type BalanceContributingEntry = Pick<
  PeonesLedgerRow,
  "event_type" | "amount"
> & { pro_bypass?: boolean | null };

/**
 * Computes the wallet balance from append-only entries. Mirrors the
 * `peones_balances` SQL view exactly:
 *  - `earn` and `adjustment` add `amount`.
 *  - `rollback` subtracts `amount`.
 *  - `spend` subtracts `amount` ONLY when `pro_bypass` is falsy.
 *
 * That last clause is not a detail. A PRO-bypassed spend is recorded
 * for audit + quota tracking with `debited = 0`; the SQL view, the
 * `peones_spend` RPC and `peones_balance_with_caps` all exclude it.
 * A helper that subtracted it anyway would report a balance lower
 * than the one the user can actually spend — the exact divergence
 * migration 20260721030000 was written to close.
 *
 * Unknown `event_type` values are ignored (the SQL CHECK constraint
 * makes them impossible in practice; this helper stays defensive).
 */
export function computeLedgerBalance(
  entries: readonly BalanceContributingEntry[],
): number {
  let balance = 0;
  for (const e of entries) {
    if (e.event_type === "earn" || e.event_type === "adjustment") {
      balance += e.amount;
    } else if (e.event_type === "rollback") {
      balance -= e.amount;
    } else if (e.event_type === "spend") {
      if (!e.pro_bypass) balance -= e.amount;
    }
  }
  return balance;
}

// ─────────────────────────────────────────────────────────────────
// Daily cap
// ─────────────────────────────────────────────────────────────────

export type DailyCapInput = {
  /** What the caller wants to credit (e.g. 3 for a Daily Tactic
   *  completion). Must be a positive integer. */
  requestedAmount: number;
  /** Total Peones already earned today from daily-family sources
   *  for this wallet. Comes from `peones_balance_with_caps`. */
  dailyEarnedCapped: number;
  /** Cap value in effect for this UTC day. Sprint 3 ships at 10
   *  (PEONES_DAILY_CAP). */
  dailyCap: number;
};

export type DailyCapResult = {
  /** What the endpoint should actually insert into the ledger. May
   *  be 0 (full cap reached) or less than `requestedAmount` (partial
   *  truncation). */
  creditedAmount: number;
  /** True iff the cap is met or exceeded AFTER this credit lands —
   *  signals the endpoint to emit `peones_cap_reached`. */
  capReached: boolean;
  /** Headroom before this credit lands. Useful for telemetry. */
  remainingBefore: number;
  /** Headroom after this credit lands. */
  remainingAfter: number;
};

/**
 * Truncates an incoming earn against the daily cap. Pure math; the
 * caller is responsible for actually applying the result.
 *
 * Behaviour:
 *  - Headroom = max(0, cap - alreadyEarned).
 *  - creditedAmount = min(requested, headroom).
 *  - capReached = (alreadyEarned + credited) >= cap.
 *
 * Negative inputs throw `Error("invalid_cap_input")` — defensive
 * because all three fields originate from server-trusted sources
 * and a negative would be a logic bug, not a user-driven case.
 */
export function applyDailyCap(input: DailyCapInput): DailyCapResult {
  const { requestedAmount, dailyEarnedCapped, dailyCap } = input;
  if (
    !Number.isFinite(requestedAmount) ||
    !Number.isFinite(dailyEarnedCapped) ||
    !Number.isFinite(dailyCap) ||
    requestedAmount < 0 ||
    dailyEarnedCapped < 0 ||
    dailyCap < 0
  ) {
    throw new Error("invalid_cap_input");
  }
  const remainingBefore = Math.max(0, dailyCap - dailyEarnedCapped);
  const creditedAmount = Math.min(requestedAmount, remainingBefore);
  const remainingAfter = remainingBefore - creditedAmount;
  const capReached = dailyEarnedCapped + creditedAmount >= dailyCap;
  return { creditedAmount, capReached, remainingBefore, remainingAfter };
}

/**
 * Returns true if the source is subject to the daily cap. Reuses the
 * canonical TS constant — duplicating the list anywhere else would
 * defeat the schema-sync guard test from commit A.
 */
export function isDailyCapSource(source: PeonesLedgerSource): boolean {
  return (PEONES_DAILY_CAP_SOURCES as readonly string[]).includes(source);
}

// ─────────────────────────────────────────────────────────────────
// Idempotency key builders
// ─────────────────────────────────────────────────────────────────
//
// Format mirrors calibration §9 verbatim. Every builder normalises
// the wallet via `normalizeWallet` so concurrent writes from
// mixed-case clients still collapse onto a single key.
//
// Keep in lockstep with the SQL UNIQUE index on idempotency_key.

export function buildDailyTacticIdempotencyKey(
  wallet: string,
  dayUtc: string,
  puzzleId: string,
): string {
  return `daily_tactic:${normalizeWallet(wallet)}:${dayUtc}:${puzzleId}`;
}

export function buildDailyStreakBonusIdempotencyKey(
  wallet: string,
  dayUtc: string,
  streak: number,
): string {
  return `daily_streak_bonus:${normalizeWallet(wallet)}:${dayUtc}:${streak}`;
}

// ─────────────────────────────────────────────────────────────────
// Exercise milestones (Economy V1, 2026-07-21)
// ─────────────────────────────────────────────────────────────────
//
// Training no longer pays per exercise. It pays once per group of five
// NEW exercises: the 5th, 10th, 15th… completion each credit +1 Peón.
// Repetitions, star improvements and re-completions pay nothing.

/** How many NEW exercises buy one Peón. */
export const EXERCISE_MILESTONE_SIZE = 5;

/** Reward tier for a lifetime count of uniquely completed exercises.
 *  Tier 0 = nothing earned yet; tier N = N milestones crossed. */
export function exerciseMilestoneTier(uniqueCompleted: number): number {
  if (!Number.isFinite(uniqueCompleted) || uniqueCompleted <= 0) return 0;
  return Math.floor(uniqueCompleted / EXERCISE_MILESTONE_SIZE);
}

/**
 * Idempotency key for one exercise milestone.
 *
 * The tier — NOT the exercise — is the economic identity, and that is
 * what makes the reward safe without a new counter table: the global
 * unique index on `idempotency_key` means tier N can be credited at
 * most once per wallet, forever. A retry, a double-tap, a re-completed
 * exercise, or a player who clears local progress and crosses the same
 * threshold again all collapse onto the same key and the endpoint
 * answers `duplicate: true` with no second row.
 */
export function buildExerciseMilestoneIdempotencyKey(
  wallet: string,
  tier: number,
): string {
  return `exercise_milestone:${normalizeWallet(wallet)}:${tier}`;
}

// ─────────────────────────────────────────────────────────────────
// Attestation hash — moved to ledger-service-server.ts
// ─────────────────────────────────────────────────────────────────
//
// Sprint 3 commit J (2026-06-07) — the SHA-256 attestation helper
// imports `node:crypto`, which Webpack cannot resolve when this
// module is reached through a client bundle (e.g. PeonesBalanceChip
// → usePeonesBalance → normalizeWallet). The function was extracted
// to `./ledger-service-server.ts` so the earn endpoint route
// (server-only) keeps the import while the client-safe helpers
// above can be imported anywhere.
