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
