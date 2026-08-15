/**
 * The referee: what is legal, and who won. Pure, server-side, over chess.js.
 *
 * ⛔ Why this block exists on its own, before any route or table: it is the only
 * one where a bug is silent and permanent. A miswired route shows up on the
 * first tap; a referee that accepts an illegal move in a rare position is never
 * seen. Being pure, it can be tested exhaustively without booting anything.
 *
 * ⚠️ A move is judged against `fen`, NEVER by replaying the game from move 1.
 * `moves` is here for the one rule that genuinely needs the history — threefold
 * repetition — and for showing the game.
 */

import { Chess } from "chess.js";

import type { DuelColor, DuelOutcome } from "./types";

export const STARTING_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export type RefereeResult =
  | {
      ok: true;
      /** SAN as chess.js normalizes it — that is what gets appended to `moves`. */
      san: string;
      fen: string;
      outcome: DuelOutcome | null;
    }
  | { ok: false; code: "not-your-turn" }
  | { ok: false; code: "illegal-move" };

/**
 * Apply `san` to `fen` on behalf of `seat`.
 *
 * The route maps this onto the spec's `ApplyMoveResult`: it owns the seat
 * credential, the CAS on `version` and the clock; the referee owns the board.
 *
 * ⚠️ A `fen` that chess.js cannot parse throws. That is a corrupt row, not a
 * player error, and it must not be reported as `illegal-move`.
 */
export function applyMove(
  fen: string,
  moves: readonly string[],
  seat: DuelColor,
  san: string,
): RefereeResult {
  const game = new Chess(fen);

  if (game.turn() !== seat) return { ok: false, code: "not-your-turn" };

  let played: { san: string } | null = null;
  try {
    // chess.js 1.x throws on an illegal or unparseable SAN.
    played = game.move(san);
  } catch {
    return { ok: false, code: "illegal-move" };
  }
  if (!played) return { ok: false, code: "illegal-move" };

  const nextFen = game.fen();
  return {
    ok: true,
    san: played.san,
    fen: nextFen,
    outcome: outcomeOf(game, seat, moves, played.san, nextFen),
  };
}

function outcomeOf(
  game: Chess,
  mover: DuelColor,
  history: readonly string[],
  san: string,
  fen: string,
): DuelOutcome | null {
  if (game.isCheckmate()) return { kind: "checkmate", winner: mover };
  if (game.isStalemate()) return { kind: "draw", reason: "stalemate" };
  if (game.isInsufficientMaterial()) {
    return { kind: "draw", reason: "insufficient-material" };
  }
  if (isThreefoldRepetition([...history, san], fen)) {
    return { kind: "draw", reason: "threefold-repetition" };
  }
  if (game.isDrawByFiftyMoves()) return { kind: "draw", reason: "fifty-move" };
  return null;
}

/**
 * Threefold repetition, the one rule the current position cannot answer alone:
 * a `Chess` built from a FEN has seen its position exactly once.
 *
 * ⚠️ The half-move clock gates the walk. A position can only repeat between
 * irreversible moves, so three occurrences need at least 8 half-moves since the
 * last capture or pawn push — below that there is nothing to look for and the
 * history is never touched. That keeps the common move off the replay path
 * while still answering the rule correctly when it can actually apply.
 *
 * A history that cannot be replayed (drift, a duel seeded from a FEN) answers
 * `false` rather than throwing: missing a repetition offers a draw the players
 * can still claim by repeating again; refusing the move would end the game.
 */
function isThreefoldRepetition(history: readonly string[], fen: string): boolean {
  const halfMoves = Number(fen.split(" ")[4]);
  if (!Number.isFinite(halfMoves) || halfMoves < 8) return false;

  const target = positionKey(fen);
  const game = new Chess();
  let seen = positionKey(game.fen()) === target ? 1 : 0;

  try {
    for (const move of history) {
      game.move(move);
      if (positionKey(game.fen()) === target) seen += 1;
    }
  } catch {
    return false;
  }

  return seen >= 3;
}

/** Placement, side to move, castling rights and en-passant square — the four
 *  fields that make two positions "the same" for the repetition rule. */
function positionKey(fen: string): string {
  return fen.split(" ").slice(0, 4).join(" ");
}
