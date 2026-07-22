/**
 * Daily Tactic → Peones earn submission.
 *
 * Sprint 3 commit E of Training Economy Alpha 2026-06-07. Pure async
 * wrapper around `POST /api/peones/earn` for the Daily Tactic earn
 * flow. The hub-daily-tile and daily-tactic-slot components call
 * this from `handleSolve(movesUsed)` after recording the local
 * completion + streak — the earn is the LAST step and its failure
 * NEVER reverts the Daily completion or streak.
 *
 * Separated from the components so the success / cap / error
 * branches can be unit-tested in isolation without renderHook +
 * fetch mocks at the React layer.
 */

import { buildDailyTacticIdempotencyKey, normalizeWallet } from "@/lib/peones/ledger-service";
import { dispatchPeonesChange } from "@/lib/peones/peones-events";
import type { DailyTacticData } from "./daily-puzzles";

/** Single source of truth for the per-Daily Tactic earn amount. The
 *  endpoint cap-truncates this server-side when daily-family sources
 *  exhaust the daily cap, so we only need a single literal here.
 *
 *  Economy V1 (2026-07-21): 3 → 1. At 3/day the Daily alone paid for a
 *  Hint every day and a Coach analysis every four, which is the whole
 *  sink budget handed out for one puzzle. One per day keeps the habit
 *  loop intact and leaves the purchase rail meaningful. Idempotency is
 *  unchanged — still one credit per wallet/day/puzzle. */
export const DAILY_TACTIC_EARN_AMOUNT = 1;

/**
 * Result of the earn submission as the sheet should render it.
 *  - "pending"        : POST in flight, render "Saving Peones…".
 *  - "success"        : Endpoint returned credited > 0. The sheet
 *                       renders rewardEarnedFormat OR
 *                       rewardCapPartialFormat depending on
 *                       capReached.
 *  - "cap_exhausted"  : Endpoint returned credited === 0 with
 *                       capReached === true (cap already met before
 *                       this attempt). Sheet renders
 *                       rewardCapExhausted.
 *  - "error"          : Network failure or non-2xx response. Sheet
 *                       renders rewardSaveFailed. Daily completion
 *                       + streak persist unchanged.
 */
export type DailyTacticRewardState =
  | { kind: "pending" }
  | {
      kind: "success";
      credited: number;
      capReached: boolean;
      /** Post-credit balance the endpoint computed optimistically. */
      newBalance: number;
      dailyEarnedCapped: number;
      dailyCap: number;
      attestationHash: string | null;
      ledgerId: number | null;
      duplicate: boolean;
    }
  | {
      kind: "cap_exhausted";
      /** Balance + cap snapshot from the endpoint at the moment the
       *  cap-exhausted decision was made. Powers `peones_cap_reached`
       *  telemetry without a second round-trip. */
      newBalance: number;
      dailyEarnedCapped: number;
      dailyCap: number;
    }
  | { kind: "error" };

export type SubmitDailyTacticEarnArgs = {
  wallet: string;
  dayUtc: string;
  puzzle: DailyTacticData;
  /** Override for testing. Defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
};

type EarnResponse = {
  wallet?: string;
  credited?: number;
  capReached?: boolean;
  newBalance?: number;
  dailyEarnedCapped?: number;
  dailyCap?: number;
  attestationHash?: string | null;
  ledgerId?: number | null;
  duplicate?: boolean;
};

/**
 * POST /api/peones/earn for a Daily Tactic completion. Wallet is
 * normalised inside the idempotency key builder; we also normalise
 * the body wallet explicitly so callers can pass mixed-case
 * addresses safely.
 *
 * Returns the rewardState the sheet should render. NEVER throws —
 * any error path resolves to `{ kind: "error" }`. The caller must
 * preserve the Daily completion + streak regardless of the result.
 */
export async function submitDailyTacticEarn(
  args: SubmitDailyTacticEarnArgs,
): Promise<DailyTacticRewardState> {
  const { wallet: rawWallet, dayUtc, puzzle, fetchImpl } = args;
  const doFetch = fetchImpl ?? fetch;

  let wallet: string;
  try {
    wallet = normalizeWallet(rawWallet);
  } catch {
    // The mount component already gates on `isConnected && address`,
    // but if a malformed address slips through, surface as error so
    // the sheet shows the recoverable copy instead of throwing.
    return { kind: "error" };
  }

  const idempotencyKey = buildDailyTacticIdempotencyKey(
    wallet,
    dayUtc,
    puzzle.id,
  );

  let res: Response;
  try {
    res = await doFetch("/api/peones/earn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wallet,
        amount: DAILY_TACTIC_EARN_AMOUNT,
        source: "daily_tactic",
        sourceId: puzzle.id,
        idempotencyKey,
      }),
    });
  } catch {
    return { kind: "error" };
  }

  if (!res.ok) {
    return { kind: "error" };
  }

  let json: EarnResponse;
  try {
    json = (await res.json()) as EarnResponse;
  } catch {
    return { kind: "error" };
  }

  const credited = Number(json.credited ?? 0);
  const capReached = Boolean(json.capReached);
  const newBalance = Number(json.newBalance ?? 0);
  const dailyEarnedCapped = Number(json.dailyEarnedCapped ?? 0);
  const dailyCap = Number(json.dailyCap ?? 10);

  if (credited === 0) {
    // Server returned credited:0. Per the endpoint contract this
    // means the cap was already exhausted (no row written). Sheet
    // renders rewardCapExhausted. Treat as success-with-zero — NOT
    // as an error — so streak still counts as solved. Carry the
    // cap snapshot so the consumer can emit `peones_cap_reached`
    // telemetry without a second round-trip.
    return { kind: "cap_exhausted", newBalance, dailyEarnedCapped, dailyCap };
  }

  // Credited > 0 — the balance moved, so every mounted reader re-reads.
  // NOT dispatched on the `cap_exhausted` branch above (credited === 0,
  // no row written) nor on any error branch: the chip must only move
  // when Peones actually arrived.
  dispatchPeonesChange("daily");

  return {
    kind: "success",
    credited,
    capReached,
    newBalance,
    dailyEarnedCapped,
    dailyCap,
    attestationHash: json.attestationHash ?? null,
    ledgerId: json.ledgerId ?? null,
    duplicate: Boolean(json.duplicate),
  };
}
