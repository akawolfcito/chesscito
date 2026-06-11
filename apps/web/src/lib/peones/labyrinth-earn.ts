/* ── Labyrinth completion earn (Slice 4, integrated training path) ──
 *
 * Flat +1 Peón on the FIRST completion of a labyrinth (bestBefore ==
 * null), mirroring the exercise rule in training-earn.ts. Improving a
 * best (even 1★ → 3★) never earns again — stars stay the progress
 * signal, Peones stay a controlled currency.
 *
 * Source `labyrinth_completion` is daily-capped (red-team P1
 * economy-cap), so the endpoint may truncate the +1 to remaining
 * headroom. Total uncapped supply is bounded anyway: one Peón per
 * catalog labyrinth (18 lifetime today).
 *
 * Idempotency: `labyrinth_completion:{wallet}:{piece}:{labyrinthId}`.
 * The wallet is INSIDE the key (deviation from the spec's
 * `labyrinth_completion:{piece}:{labyrinthId}` shorthand) because
 * `peones_ledger_idempotency_uq` is a GLOBAL unique index — without
 * the wallet, two players completing the same lab would collide and
 * the second would never be credited. No attempt/seq in the key, so a
 * replay or a double-tap race collapses to one ledger row server-side
 * (red-team P1 first-completion-race).
 */

import type { PieceId } from "@/lib/game/types";
import { normalizeWallet } from "./ledger-service";
import { PEONES_DAILY_CAP } from "./types";

export type LabyrinthCompletionRewardState =
  | {
      kind: "success";
      credited: number;
      newBalance: number;
      dailyEarnedCapped: number;
      dailyCap: number;
      attestationHash: string | null;
      ledgerId: number | null;
      duplicate: boolean;
    }
  | { kind: "error" };

export type SubmitLabyrinthCompletionEarnArgs = {
  wallet: string;
  piece: PieceId;
  labyrinthId: string;
  /** Best move count BEFORE this completion (null = never completed).
   *  Read it from getLabyrinthBest BEFORE recordLabyrinthBest runs. */
  bestBefore: number | null;
  /** Override for testing. Defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
};

export function buildLabyrinthCompletionIdempotencyKey(
  wallet: string,
  piece: PieceId,
  labyrinthId: string,
): string {
  return `labyrinth_completion:${wallet.toLowerCase()}:${piece}:${labyrinthId}`;
}

type EarnResponse = {
  credited?: number;
  newBalance?: number;
  dailyEarnedCapped?: number;
  dailyCap?: number;
  attestationHash?: string | null;
  ledgerId?: number | null;
  duplicate?: boolean;
};

export async function submitLabyrinthCompletionEarn(
  args: SubmitLabyrinthCompletionEarnArgs,
): Promise<LabyrinthCompletionRewardState> {
  const { wallet: rawWallet, piece, labyrinthId, bestBefore, fetchImpl } = args;
  const doFetch = fetchImpl ?? fetch;

  // First-completion only. A recorded best means the lab already paid.
  if (bestBefore !== null) {
    return {
      kind: "success",
      credited: 0,
      newBalance: 0,
      dailyEarnedCapped: 0,
      dailyCap: PEONES_DAILY_CAP,
      attestationHash: null,
      ledgerId: null,
      duplicate: false,
    };
  }

  let wallet: string;
  try {
    wallet = normalizeWallet(rawWallet);
  } catch {
    return { kind: "error" };
  }

  let res: Response;
  try {
    res = await doFetch("/api/peones/earn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wallet,
        amount: 1,
        source: "labyrinth_completion",
        sourceId: `${piece}:${labyrinthId}`,
        idempotencyKey: buildLabyrinthCompletionIdempotencyKey(
          wallet,
          piece,
          labyrinthId,
        ),
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

  return {
    kind: "success",
    credited: Number(json.credited ?? 0),
    newBalance: Number(json.newBalance ?? 0),
    dailyEarnedCapped: Number(json.dailyEarnedCapped ?? 0),
    dailyCap: Number(json.dailyCap ?? PEONES_DAILY_CAP),
    attestationHash: json.attestationHash ?? null,
    ledgerId: json.ledgerId ?? null,
    duplicate: Boolean(json.duplicate),
  };
}
