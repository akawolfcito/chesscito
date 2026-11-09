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

import type { AttemptMeasurement } from "./attempt-measurement";
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
  /**
   * ¿Este guardado tiene derecho a interrumpir al jugador con una firma?
   *
   * ⛔ REQUERIDO. Se reenvía a las DOS llamadas a `ensureScoreSession` — la
   * inicial y la re-autorización tras un rechazo del server. Cubrir sólo la
   * primera deja abierta la fuga del jugador que vuelve al día siguiente: su
   * token persistido puede seguir dentro de su ventana local (así que la caché
   * lo sirve sin firmar) mientras el server ya lo dio de baja, y ahí la
   * re-auth abría la wallet.
   *
   * Spec: docs/specs/2026-08-09-attempt-save-never-ambushes-v3.md §3
   */
  promptPolicy: "allow" | "deny";
  /**
   * ── SLICE 3 (attempt identity) ─────────────────────────────────────────
   * All three are OPTIONAL, and that is the deploy order, not laziness. The
   * endpoint and the migration ship first; a bundle older than them sends
   * none of these and the server mints an id, marks it `attempt_id_source =
   * 'server'` and files the row `ungraded`. Correct, and legible as such.
   *
   * `attemptId` is what makes a retry a REPLAY: re-sending the same id
   * inserts nothing and consumes no budget, so a failed POST retried three
   * times is still one attempt. Rotating it would turn each retry into a new
   * attempt on a permanent table.
   *
   * `measurement` is a RAW number, never a star count: the client does not
   * pick the grader and does not send stars (D12). The bucket the catalogue
   * puts `exerciseId` in decides which grader runs, server-side.
   */
  attemptId?: string;
  exerciseId?: string;
  measurement?: AttemptMeasurement;
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
      // The three attempt fields are OMITTED rather than sent as null when
      // absent: `resolveAttemptIdentity` treats an absent id as "mint one" and
      // a present-but-unusable one as a 400, so an explicit null would be the
      // difference between a recorded play and a rejected request.
      body: JSON.stringify({
        levelId: input.levelId,
        score: input.score,
        timeMs: input.timeMs,
        ...(input.attemptId !== undefined ? { attemptId: input.attemptId } : {}),
        ...(input.exerciseId !== undefined ? { exerciseId: input.exerciseId } : {}),
        ...(input.measurement !== undefined ? { measurement: input.measurement } : {}),
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
    promptPolicy: input.promptPolicy,
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
  //
  // ⛔ Sin derecho a interrumpir, esto termina acá — y sin limpiar. Borrar la
  // sesión costaría un prompt EVITABLE en el próximo tap del jugador, por un
  // intento de fondo que él no inició: si el rechazo fue transitorio, el token
  // que tenía servía. El intento vuelve como error retryable y espera a la
  // próxima completación, que sí puede firmar.
  if (input.promptPolicy === "deny") return first;

  clearScoreSession();
  const refreshed = await ensureScoreSession({
    wallet: input.player,
    surface: input.surface,
    signMessage: input.signMessage,
    fetchImpl,
    now,
    forceRefresh: true,
    promptPolicy: input.promptPolicy,
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
