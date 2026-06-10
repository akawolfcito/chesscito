"use client";

/**
 * SaveScore off-chain — client seam (Slice 5).
 *
 * `postScoreSave` REPLACES the on-chain sign-score + submitScoreSigned
 * path in the base game loop. It is the single place the UI calls to
 * persist a basic score: derive the deterministic saveId, POST
 * /api/scores/save, and return the shared `BasicScoreSaveResult` union
 * the overlay renders.
 *
 * Off-chain only: this module imports NO contract ABI, NO wagmi/viem, NO
 * /api/sign-score. It never signs, never broadcasts a tx, never prompts
 * approve/send. The retained on-chain path (sign-score + submitScoreSigned
 * + Scoreboard) lives untouched as the future Leaderboard Proof lane.
 *
 * Failure policy mirrors the spec: a network throw or an unparseable /
 * unexpected body degrades to `{ status: "error" }` — the caller never
 * has to try/catch, and the client NEVER fabricates a "saved" the server
 * did not return.
 */

import {
  deriveScoreSaveId,
  type BasicScoreSaveResult,
} from "./save-service";

export type ScoreSaveClientInput = {
  player: `0x${string}`;
  levelId: number;
  score: number;
  timeMs: number;
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

function isBasicScoreSaveResult(v: unknown): v is BasicScoreSaveResult {
  if (typeof v !== "object" || v === null) return false;
  const status = (v as { status?: unknown }).status;
  return typeof status === "string" && KNOWN_STATUSES.has(status as BasicScoreSaveResult["status"]);
}

/**
 * Persist a basic score off-chain. `gameId` is the score itself so the
 * derived saveId (`player:levelId:score`) gives best-score-per-level
 * dedup: re-saving the same score is idempotent (`duplicate`), while a
 * higher score is a fresh row the combined leaderboard's MAX picks up.
 *
 * `fetchImpl` is injectable for tests; defaults to the global `fetch`.
 */
export async function postScoreSave(
  input: ScoreSaveClientInput,
  fetchImpl: typeof fetch = fetch,
): Promise<BasicScoreSaveResult> {
  const gameId = String(input.score);
  const saveId = deriveScoreSaveId(input.player, input.levelId, gameId);

  let res: Response;
  try {
    res = await fetchImpl("/api/scores/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        player: input.player,
        levelId: input.levelId,
        score: input.score,
        timeMs: input.timeMs,
        gameId,
        saveId,
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

  if (isBasicScoreSaveResult(data)) {
    return data;
  }
  return { status: "error", reason: "bad_response" };
}
