/**
 * Peones telemetry — Sprint 3 commit H of Training Economy Alpha
 * 2026-06-07. Three events fired client-side through the existing
 * `track()` stack:
 *
 *  - peones_earned         : after `/api/peones/earn` returns 200 with
 *                            credited > 0. Daily Tactic AND Training.
 *  - peones_cap_reached    : when the response carries capReached:true
 *                            (partial-credit cap or cap_exhausted
 *                            branch). Dedup is the CALLER's job via
 *                            useRef so we keep these emitters pure.
 *  - peones_balance_viewed : when the HUD chip renders the success
 *                            state. The chip-side useEffect dedups
 *                            against the last emitted balance so a
 *                            re-render with the same number does not
 *                            re-emit.
 *
 * Fire-and-forget per the existing track() contract — any failure
 * inside the network call is swallowed so an analytics outage cannot
 * break the Daily / Training / chip flows.
 */

import { track } from "@/lib/telemetry";
import type { PeonesSpendTarget } from "./spend-service";
import type { PeonesLedgerSource } from "./types";

export type PeonesEarnedEventArgs = {
  source: PeonesLedgerSource;
  sourceId: string;
  requested: number;
  credited: number;
  capReached: boolean;
  newBalance: number;
  dailyEarnedCapped: number;
  dailyCap: number;
  attestationHash: string | null;
  duplicate: boolean;
};

export function emitPeonesEarned(args: PeonesEarnedEventArgs): void {
  track("peones_earned", {
    source: args.source,
    sourceId: args.sourceId,
    requested: args.requested,
    credited: args.credited,
    capReached: args.capReached,
    newBalance: args.newBalance,
    dailyEarnedCapped: args.dailyEarnedCapped,
    dailyCap: args.dailyCap,
    attestationHash: args.attestationHash,
    duplicate: args.duplicate,
  });
}

export type PeonesCapReachedEventArgs = {
  source: PeonesLedgerSource;
  sourceId: string;
  requested: number;
  credited: number;
  dailyEarnedCapped: number;
  dailyCap: number;
};

export function emitPeonesCapReached(args: PeonesCapReachedEventArgs): void {
  track("peones_cap_reached", {
    source: args.source,
    sourceId: args.sourceId,
    requested: args.requested,
    credited: args.credited,
    dailyEarnedCapped: args.dailyEarnedCapped,
    dailyCap: args.dailyCap,
  });
}

/** Surface the HUD chip is mounted on. Sprint 3 commit G ships only
 *  the "hub" surface; other surfaces map cleanly onto the same
 *  enum when they adopt the chip. */
export type PeonesBalanceViewSurface =
  | "hub"
  | "exercises"
  | "coach"
  | "arena";

export type PeonesBalanceViewedEventArgs = {
  balance: number;
  dailyEarnedCapped: number;
  dailyCap: number;
  surface: PeonesBalanceViewSurface;
};

export function emitPeonesBalanceViewed(
  args: PeonesBalanceViewedEventArgs,
): void {
  track("peones_balance_viewed", {
    balance: args.balance,
    dailyEarnedCapped: args.dailyEarnedCapped,
    dailyCap: args.dailyCap,
    surface: args.surface,
  });
}

// ─────────────────────────────────────────────────────────────────
// Sprint 4 commit D — spend events
// ─────────────────────────────────────────────────────────────────
//
// Three spend-side events fired by the FUTURE consumer (Hint button
// in commit E, Coach integration in commit F). The submit helper
// itself is pure — it returns the result and the consumer decides
// which event to fire. This mirrors the earn-side pattern where
// `submitTrainingExerciseEarn` / `submitDailyTacticEarn` do not emit.
//
// Why three events, not one with a status enum: dashboards prefer
// non-conditional event names. Filtering by status in a single
// `peones_spend` would hide the failure rate behind a downstream
// query that may or may not be written.
//
// NOT emitted when `debited === 0` because of PRO bypass — that case
// gets its own `peones_spend_bypassed` event in Sprint 4 commit G
// where the PRO resolver lights up. Keeping it out of this commit
// preserves the dashboard semantic "peones_spent always means real
// Peones left the wallet".

export type PeonesSpentEventArgs = {
  target: PeonesSpendTarget;
  targetId: string;
  requested: number;
  debited: number;
  newBalance: number;
  attestationHash: string;
  duplicate: boolean;
  proBypassApplied: boolean;
};

export function emitPeonesSpent(args: PeonesSpentEventArgs): void {
  track("peones_spent", {
    target: args.target,
    targetId: args.targetId,
    requested: args.requested,
    debited: args.debited,
    newBalance: args.newBalance,
    attestationHash: args.attestationHash,
    duplicate: args.duplicate,
    proBypassApplied: args.proBypassApplied,
  });
}

export type PeonesSpendBlockedEventArgs = {
  target: PeonesSpendTarget;
  targetId: string;
  requested: number;
  reason: "insufficient_balance";
};

export function emitPeonesSpendBlocked(
  args: PeonesSpendBlockedEventArgs,
): void {
  track("peones_spend_blocked", {
    target: args.target,
    targetId: args.targetId,
    requested: args.requested,
    reason: args.reason,
  });
}

export type PeonesSpendFailedEventArgs = {
  target: PeonesSpendTarget;
  targetId: string;
  requested: number;
  reason: string;
};

export function emitPeonesSpendFailed(
  args: PeonesSpendFailedEventArgs,
): void {
  track("peones_spend_failed", {
    target: args.target,
    targetId: args.targetId,
    requested: args.requested,
    reason: args.reason,
  });
}

// ─────────────────────────────────────────────────────────────────
// Sprint 4 commit G — PRO bypass usage
// ─────────────────────────────────────────────────────────────────
//
// Fires when the server's PRO bypass evaluation lit up: the user is
// PRO + within the daily quota for this target. The ledger row is
// audit-only (debited=0, balance unchanged); this event is the
// dashboard signal "PRO actually saved this user a Peón today".
//
// `peones_spent` is NOT fired alongside this — the dashboard rule
// stays "spent === real Peones left the wallet". Bypass usage is a
// distinct semantic.

export type PeonesSpendBypassedEventArgs = {
  target: PeonesSpendTarget;
  targetId: string;
  requested: number;
  /** Always 0 by definition of bypass — kept in the event for
   *  symmetry with `peones_spent` so dashboards can join the two. */
  debited: 0;
  newBalance: number;
  /** Mirrors `peones_spent.attestationHash` — the bypass row is in
   *  the ledger so the audit trail is queryable by hash. */
  attestationHash: string;
  /** PRO bypass daily-quota state AFTER this call.
   *  quotaUsed counts the row that just landed. */
  quotaUsed: number;
  quotaLimit: number;
};

export function emitPeonesSpendBypassed(
  args: PeonesSpendBypassedEventArgs,
): void {
  track("peones_spend_bypassed", {
    target: args.target,
    targetId: args.targetId,
    requested: args.requested,
    debited: args.debited,
    newBalance: args.newBalance,
    attestationHash: args.attestationHash,
    proBypassApplied: true,
    quotaUsed: args.quotaUsed,
    quotaLimit: args.quotaLimit,
  });
}
