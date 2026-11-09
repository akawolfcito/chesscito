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
import { resolveDeploymentSurface } from "@/lib/scores/deployment-surface";
import {
  ensureScoreSession,
  type ScoreSession,
  type SignMessageFn,
} from "@/lib/scores/session-client";

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
  /**
   * How this spend signs for a score session when it does not have one.
   *
   * ⛔ REQUIRED, no default, on purpose. Spending debits a real balance and the
   * server now demands proof of the wallet, so a caller that cannot sign cannot
   * spend. Making it required means every sink — present and future — is forced
   * by `tsc` to supply it, and no new spend path can quietly ship unable to
   * authorize itself. Same reasoning as `promptPolicy` on `ensureScoreSession`.
   */
  signMessage: SignMessageFn;
  /** Override for testing. Defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
  /** Override for testing. Replaces the whole session acquisition. */
  ensureSessionImpl?: () => Promise<ScoreSession | null>;
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
    signMessage,
    fetchImpl,
    ensureSessionImpl,
  } = args;
  const doFetch = fetchImpl ?? fetch;

  let wallet: string;
  try {
    wallet = normalizeWallet(rawWallet);
  } catch {
    return { kind: "error", error: "invalid_wallet" };
  }

  // CALLER AUTHORIZATION (P0, 2026-08-10 — rollout step 1).
  //
  // The route must stop trusting `wallet` from the body and resolve it from a
  // signed score write-session instead. It can only do that if this request
  // CARRIES the token, so the client ships first with the server flag still
  // off, and the flag flips only once these headers are observed arriving.
  //
  // Attached here rather than in each sink for the same reason the
  // `peones-changed` dispatch lives here: this is the one place hint, coach and
  // shield all funnel through, so no sink can forget it.
  //
  // CALLER AUTHORIZATION — reuse a session, or MINT one, right here.
  //
  // ⛔ `promptPolicy` is fixed to "allow" and is deliberately NOT a parameter.
  //
  // The rule is: a Peones spend may always ask for the signature, because a
  // Peones spend is ALWAYS something the player asked for. Verified 2026-08-10
  // across all three sinks — hint is an `onClick`, the shield runs inside
  // `onUseShield`, and the coach inside `startCoachAnalysis` (that module does
  // not even import `useEffect`). There is no machine-triggered spend, so this
  // cannot become the kind of ambush `never-ambushes-v3` exists to prevent.
  //
  // It is a rule and not a flag on purpose: an optional policy is a door to get
  // it wrong, and reasoning per-sink about "this one runs after gameplay so a
  // session will already exist" is a fact about today's UX, not an invariant —
  // move a sink earlier and the hole reopens with nothing turning red.
  //
  // Why minting is REQUIRED and reading was not enough: the session lives 2h
  // (`SCORE_SESSION_TTL_SECONDS`). Anyone returning the next day has an expired
  // one, so "no usable session" is the ordinary state of a returning player,
  // not an edge case. Reading memory-then-disk only fixed the reopen-within-2h
  // case (measured in preview, 2026-08-10); this fixes the daily one.
  //
  // `ensureScoreSession` still short-circuits on memory and then disk, so the
  // prompt appears only when there is genuinely nothing to reuse — at most once
  // every 2h, on an action the player just took.
  //
  // The surface comes from `resolveDeploymentSurface()`, the SAME function the
  // save path passes when the session is minted (`exercises-screen.tsx`).
  // Resolving it any other way would look up a session keyed to a surface we
  // never issued and silently find nothing.
  let session: ScoreSession | null = null;
  let sessionFailure: string | null = null;
  try {
    if (ensureSessionImpl) {
      session = await ensureSessionImpl();
    } else {
      const result = await ensureScoreSession({
        wallet,
        surface: resolveDeploymentSurface(),
        signMessage,
        promptPolicy: "allow",
      });
      if (result.ok) {
        session = result.session;
      } else {
        sessionFailure = result.error;
      }
    }
  } catch {
    // "NEVER throws" is this module's invariant (see header): a broken session
    // store degrades to a result branch, never to an exception on a spend.
    sessionFailure = "session_required";
  }

  if (!session) {
    // Do NOT fire a request we already know the server will reject. A declined
    // signature is a DECISION, not a failure, and it deserves its own reason so
    // the UI can tell "you cancelled" apart from "something broke" instead of
    // both arriving as an opaque 401.
    return {
      kind: "error",
      error: sessionFailure ?? "session_required",
    };
  }

  const sessionToken = session.token;

  let res: Response;
  try {
    res = await doFetch("/api/peones/spend", {
      method: "POST",
      // Always present now: the request does not leave without a session, so
      // there is no header-less spend to reason about any more.
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
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
