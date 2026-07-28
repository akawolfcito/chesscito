"use client";

/**
 * SaveScore off-chain — client seam.
 *
 * `postScoreSave` is the single place the UI calls to persist a basic score.
 * Off-chain only: this module imports NO contract ABI, NO wagmi/viem, NO
 * /api/sign-score. It never broadcasts a tx.
 *
 * ── SLICE 0.1 (2026-07-30) ──────────────────────────────────────────────
 * The save is authored by a SESSION, not by a per-save signature. The first
 * puntuable save of a session mints one (one wallet prompt, via
 * `session-client.ts`); every save after that is silent and carries
 * `Authorization: Bearer <token>`.
 *
 * There is deliberately no `player` field in the request: the server reads the
 * wallet out of the session row. Passing an address alongside would invite a
 * future reader to trust it.
 *
 * EXPIRY HANDLING — exactly one retry, never a loop
 * -------------------------------------------------
 * A token can die between the client's check and the server's (revoked
 * mid-session, clock skew, a redeploy). When the server says the session is no
 * longer valid, we re-authorize ONCE — costing one prompt — and retry the same
 * save. If that also fails we report it. A second retry would be a prompt loop
 * the player cannot escape, which is worse than a failed save they can retry
 * by hand.
 *
 * `signMessage` is INJECTED rather than imported from wagmi, so this module
 * stays free of React hooks and is unit-testable without a wallet provider.
 */

import type { ScoreSaveSurface } from "./save-authorization";
import {
  clearScoreSession,
  ensureScoreSession,
  type SignMessageFn,
} from "./session-client";
import { type BasicScoreSaveResult } from "./save-service";

export type { SignMessageFn };

export type ScoreSaveClientInput = {
  player: `0x${string}`;
  levelId: number;
  score: number;
  timeMs: number;
  /** Which product this build is. Bound into the session at authorize time and
   *  re-checked server-side against the deployment. */
  surface: ScoreSaveSurface;
  signMessage: SignMessageFn;
};

/** Statuses the endpoint can return — used to validate the JSON body
 *  before trusting it as a `BasicScoreSaveResult`. */
const KNOWN_STATUSES = new Set<BasicScoreSaveResult["status"]>([
  "saved",
  "duplicate",
  "insufficient_peones",
  "invalid",
  "rate_limited",
  "error",
]);

/** Server reasons that mean "your token is dead" — the only ones worth one
 *  re-authorization. A bounds error or a rate limit must NEVER trigger a
 *  prompt: re-signing does not make an out-of-range score valid, it just
 *  annoys the player on the way to the same 400. */
const SESSION_DEAD_REASONS = new Set([
  "missing_session",
  "invalid_session",
  "session_expired",
  "session_revoked",
]);

function isBasicScoreSaveResult(v: unknown): v is BasicScoreSaveResult {
  if (typeof v !== "object" || v === null) return false;
  const status = (v as { status?: unknown }).status;
  return typeof status === "string" && KNOWN_STATUSES.has(status as BasicScoreSaveResult["status"]);
}

function reasonOf(result: BasicScoreSaveResult): string | null {
  return "reason" in result && typeof result.reason === "string" ? result.reason : null;
}

async function postWithToken(
  token: string,
  input: ScoreSaveClientInput,
  fetchImpl: typeof fetch,
): Promise<BasicScoreSaveResult> {
  let res: Response;
  try {
    res = await fetchImpl("/api/scores/save", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        levelId: input.levelId,
        score: input.score,
        timeMs: input.timeMs,
      }),
    });
  } catch {
    // Network / offline. The optimistic quick-save-local degrade is the
    // caller's call; the client only reports the failure honestly.
    return { status: "error", reason: "network" };
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return { status: "error", reason: "bad_response" };
  }

  return isBasicScoreSaveResult(data) ? data : { status: "error", reason: "bad_response" };
}

/**
 * Persist a basic score off-chain under the caller's write session.
 *
 * `gameId` stays the score itself server-side, so the derived saveId
 * (`player:levelId:score`) keeps its best-score-per-level dedup: re-saving the
 * same score is idempotent (`duplicate`), a higher score is a fresh row the
 * combined leaderboard's MAX picks up.
 *
 * `fetchImpl` / `now` are injectable for tests.
 */
export async function postScoreSave(
  input: ScoreSaveClientInput,
  fetchImpl: typeof fetch = fetch,
  now: number = Date.now(),
): Promise<BasicScoreSaveResult> {
  const session = await ensureScoreSession({
    wallet: input.player,
    surface: input.surface,
    signMessage: input.signMessage,
    fetchImpl,
    now,
  });

  if (!session.ok) {
    return {
      status: "error",
      reason: session.error === "signature_rejected" ? "signature_rejected" : session.error,
    };
  }

  const first = await postWithToken(session.session.token, input, fetchImpl);
  const reason = reasonOf(first);
  if (!reason || !SESSION_DEAD_REASONS.has(reason)) {
    return first;
  }

  // The token was dead server-side. Re-authorize ONCE and replay the save.
  clearScoreSession();
  const refreshed = await ensureScoreSession({
    wallet: input.player,
    surface: input.surface,
    signMessage: input.signMessage,
    fetchImpl,
    now,
    forceRefresh: true,
  });
  if (!refreshed.ok) {
    return {
      status: "error",
      reason: refreshed.error === "signature_rejected" ? "signature_rejected" : refreshed.error,
    };
  }

  // Whatever this returns is final. No third attempt: a prompt loop is worse
  // than a save the player can retry by hand.
  return postWithToken(refreshed.session.token, input, fetchImpl);
}
