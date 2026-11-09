/**
 * Which ending line a given seat reads.
 *
 * ⛔ Separated from the component and pure, because the thing that is easy to
 * get wrong here is not the layout: it is telling the LOSER they won. The
 * outcome names a winner in absolute terms (`{kind:"timeout", winner:"w"}`);
 * turning that into "you" requires knowing which seat is reading, and a
 * spectator is neither.
 */

import type { DuelColor, DuelOutcome } from "./types";

/** A key of `DUEL_COPY`. */
export type DuelOutcomeCopyKey =
  | "wonCheckmate"
  | "lostCheckmate"
  | "wonResign"
  | "lostResign"
  | "wonTimeout"
  | "lostTimeout"
  | "drawStalemate"
  | "drawInsufficient"
  | "drawRepetition"
  | "drawFiftyMove"
  | "endedNeutral";

export function outcomeCopyKey(
  outcome: DuelOutcome | null,
  you: DuelColor | null,
): DuelOutcomeCopyKey {
  if (!outcome) return "endedNeutral";

  if (outcome.kind === "draw") {
    switch (outcome.reason) {
      case "stalemate":
        return "drawStalemate";
      case "insufficient-material":
        return "drawInsufficient";
      case "threefold-repetition":
        return "drawRepetition";
      case "fifty-move":
        return "drawFiftyMove";
    }
  }

  // ⚠️ A spectator holds no seat, so there is no "you" to address. The neutral
  // line is correct for them, and inventing a side would be a lie about a game
  // they are not in.
  if (!you) return "endedNeutral";

  const won = outcome.winner === you;
  switch (outcome.kind) {
    case "checkmate":
      return won ? "wonCheckmate" : "lostCheckmate";
    case "resign":
      return won ? "wonResign" : "lostResign";
    case "timeout":
      return won ? "wonTimeout" : "lostTimeout";
  }
}
