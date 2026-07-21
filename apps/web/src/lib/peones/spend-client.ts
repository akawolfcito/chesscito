/**
 * Peones spend — client helper.
 *
 * Sprint 4 commit D of Training Economy Alpha 2026-06-08. Pure async
 * wrapper around `POST /api/peones/spend`. Mirrors the shape of
 * `submitExerciseMilestoneEarn` / `submitDailyTacticEarn` — helper is
 * NOT a telemetry emitter; the future consumer (Hint button, Coach
 * integration, etc.) decides which event fires based on the result.
 *
 * NEVER throws — every error path collapses to a result branch the
 * UI can render symmetrically. The helper does NOT touch localStorage
 * and holds NO balance state of its own.
 *
 * It does dispatch `chesscito:peones-changed` after a confirmed debit
 * (Peones V1 UX, 2026-07-21) — a signal, not a cache write. Being the
 * one place all three sinks funnel through, it guarantees no spend can
 * ship without the HUD hearing about it.
 *
 * Sprint 4 commit C ships the endpoint with `p_apply_pro_bypass`
 * hard-coded to false; this helper carries the `proBypassApplied`
 * flag through faithfully so commit G's PRO resolver can light it
 * up without a helper rewrite.
 */

import { normalizeWallet } from "@/lib/peones/ledger-service";
import { dispatchPeonesChange } from "@/lib/peones/peones-events";
import type { PeonesSpendTarget } from "@/lib/peones/spend-service";

export type PeonesSpendResult =
  | {
      kind: "success";
      wallet: string;
      target: PeonesSpendTarget;
      targetId: string;
      requested: number;
      debited: number;
      newBalance: number;
      attestationHash: string;
      ledgerId: number;
      duplicate: boolean;
      proBypassApplied: boolean;
      /** Sprint 4 commit G — PRO bypass quota state surfaced by
       *  `/api/peones/spend`. `null` for free users / lookup
       *  failures (when bypass did not enter the picture). */
      quotaUsed: number | null;
      quotaLimit: number | null;
    }
  | {
      kind: "insufficient_balance";
      /** The endpoint does NOT return current balance on 409. The
       *  field is reserved so a future consumer can backfill via a
       *  separate `GET /api/peones/balance` without changing this
       *  shape. */
      currentBalance?: number;
    }
  | {
      kind: "error";
      /** One of: "invalid_input" | "invalid_wallet" | "unknown_target"
       *  | "invalid_amount" | "invalid_idempotency_key" | "rate_limited"
       *  | "ledger_unavailable" | "ledger_write_failed" | "network"
       *  | "bad_response". Free-form so future endpoint errors don't
       *  require a helper update. */
      error: string;
    };

export type SubmitPeonesSpendArgs = {
  wallet: string;
  amount: number;
  target: PeonesSpendTarget;
  targetId: string;
  idempotencyKey: string;
  metadata?: Record<string, string | number | boolean>;
  /** Override for testing. Defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
};

type SpendResponse = {
  wallet?: string;
  target?: PeonesSpendTarget;
  targetId?: string;
  requested?: number;
  debited?: number;
  newBalance?: number;
  attestationHash?: string | null;
  ledgerId?: number | null;
  duplicate?: boolean;
  proBypassApplied?: boolean;
  quotaUsed?: number | null;
  quotaLimit?: number | null;
};

type SpendErrorResponse = {
  error?: string;
};

/**
 * POST /api/peones/spend with the canonical payload. Wallet is
 * normalised client-side too so the network payload matches the
 * idempotency-key prefix the server expects.
 */
export async function submitPeonesSpend(
  args: SubmitPeonesSpendArgs,
): Promise<PeonesSpendResult> {
  const {
    wallet: rawWallet,
    amount,
    target,
    targetId,
    idempotencyKey,
    metadata,
    fetchImpl,
  } = args;
  const doFetch = fetchImpl ?? fetch;

  let wallet: string;
  try {
    wallet = normalizeWallet(rawWallet);
  } catch {
    return { kind: "error", error: "invalid_wallet" };
  }

  let res: Response;
  try {
    res = await doFetch("/api/peones/spend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wallet,
        amount,
        target,
        targetId,
        idempotencyKey,
        ...(metadata !== undefined ? { metadata } : {}),
      }),
    });
  } catch {
    return { kind: "error", error: "network" };
  }

  if (res.status === 409) {
    // 409 today is insufficient_balance. Read body opportunistically
    // to forward the server's error code; if the body fails to parse,
    // we still classify as insufficient_balance because that is the
    // only 409 the endpoint produces in Sprint 4 commit C.
    return { kind: "insufficient_balance" };
  }

  if (!res.ok) {
    let body: SpendErrorResponse | null = null;
    try {
      body = (await res.json()) as SpendErrorResponse;
    } catch {
      // fall through with error="bad_response" below
    }
    return {
      kind: "error",
      error:
        typeof body?.error === "string" && body.error.length > 0
          ? body.error
          : `http_${res.status}`,
    };
  }

  let json: SpendResponse;
  try {
    json = (await res.json()) as SpendResponse;
  } catch {
    return { kind: "error", error: "bad_response" };
  }

  if (
    typeof json.attestationHash !== "string" ||
    typeof json.ledgerId !== "number"
  ) {
    return { kind: "error", error: "bad_response" };
  }

  // Confirmed write — tell every mounted balance reader to re-read.
  // This is the single choke point for all three sinks (hint, coach,
  // shield), so no sink can forget to signal. Placed AFTER every
  // validation branch: a 409, a 5xx, a network throw, or a malformed
  // body all return above and never reach here, so the displayed
  // balance can never move on a spend that did not happen.
  //
  // Fires on idempotent duplicates too — deliberately. Nothing fresh
  // left the wallet, but re-reading the server is always correct; it is
  // the VISUAL delta that must stay silent on duplicates, and that
  // decision belongs to the caller, which has `duplicate` in the result.
  dispatchPeonesChange(target);

  return {
    kind: "success",
    wallet,
    target,
    targetId,
    requested: Number(json.requested ?? amount),
    debited: Number(json.debited ?? 0),
    newBalance: Number(json.newBalance ?? 0),
    attestationHash: json.attestationHash,
    ledgerId: json.ledgerId,
    duplicate: Boolean(json.duplicate),
    proBypassApplied: Boolean(json.proBypassApplied),
    quotaUsed: typeof json.quotaUsed === "number" ? json.quotaUsed : null,
    quotaLimit: typeof json.quotaLimit === "number" ? json.quotaLimit : null,
  };
}
