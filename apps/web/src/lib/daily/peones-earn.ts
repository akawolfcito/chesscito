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
import type { DailyTacticData } from "./daily-puzzles";

/** Single source of truth for the per-Daily Tactic earn amount. The
 *  endpoint cap-truncates this server-side when daily-family sources
 *  exhaust the daily cap, so we only need a single literal here. */
export const DAILY_TACTIC_EARN_AMOUNT = 3;

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
  | { kind: "success"; credited: number; capReached: boolean; attestationHash: string | null; ledgerId: number | null; duplicate: boolean }
  | { kind: "cap_exhausted" }
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

  if (credited === 0) {
    // Server returned credited:0. Per the endpoint contract this
    // means the cap was already exhausted (no row written). Sheet
    // renders rewardCapExhausted. Treat as success-with-zero — NOT
    // as an error — so streak still counts as solved.
    return { kind: "cap_exhausted" };
  }

  return {
    kind: "success",
    credited,
    capReached,
    attestationHash: json.attestationHash ?? null,
    ledgerId: json.ledgerId ?? null,
    duplicate: Boolean(json.duplicate),
  };
}
