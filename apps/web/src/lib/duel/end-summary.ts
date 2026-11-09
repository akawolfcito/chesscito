/**
 * What the end-of-duel screen says, as data.
 *
 * ⛔ WHY THIS IS NOT `ArenaEndState`. That component carries thirty-odd props
 * about minting a victory, buying a Coach analysis, share cards and persistence
 * retries — the whole reward economy. The duel deliberately has NONE of it: the
 * spec is explicit that a result touches no Peones, no ranking and no badges,
 * and the day it does, the parent spec stops being valid and server-verified
 * progress has to come first. Reusing that component would drag the economy in
 * through the back door, one prop at a time.
 *
 * What the duel reuses instead is the SHELL (`VictoryPopupShell`), which is the
 * same visual family the resign modal already speaks. Same vocabulary, none of
 * the promises.
 */

import type { DuelColor, DuelOutcome, DuelPublic } from "./types";

export type DuelEndTone = "win" | "loss" | "draw" | "neutral";

export type DuelEndSummary = {
  tone: DuelEndTone;
  /** Full moves played, the way a chess player counts them. */
  moves: number;
  /** How long the game ran, or `null` when it never started. */
  elapsedMs: number | null;
};

/**
 * ⚠️ The tone is what colours the screen, and getting it backwards is the one
 * failure that matters: a loss dressed as a celebration. A spectator gets
 * `neutral` — they did not win or lose anything.
 */
export function duelEndTone(
  outcome: DuelOutcome | null,
  you: DuelColor | null,
): DuelEndTone {
  if (!outcome) return "neutral";
  if (outcome.kind === "draw") return "draw";
  if (!you) return "neutral";
  return outcome.winner === you ? "win" : "loss";
}

export function duelEndSummary(duel: DuelPublic, you: DuelColor | null): DuelEndSummary {
  return {
    tone: duelEndTone(duel.outcome, you),
    // A "move" in chess is a pair of plies. 3 plies is 2 moves: white has
    // played twice, black once.
    moves: Math.ceil(duel.moves.length / 2),
    elapsedMs: elapsedOf(duel),
  };
}

/** From the creation stamp to the last move. ⚠️ `null` rather than 0 when the
 *  game never started: an invitation nobody answered has no duration, and "0s"
 *  would read as a game that ended instantly. */
function elapsedOf(duel: DuelPublic): number | null {
  if (!duel.lastMoveAt) return null;
  const started = Date.parse(duel.createdAt);
  const ended = Date.parse(duel.lastMoveAt);
  if (Number.isNaN(started) || Number.isNaN(ended)) return null;
  return Math.max(0, ended - started);
}
