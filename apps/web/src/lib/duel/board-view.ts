/**
 * The two things the board draws that the duel row does not store directly:
 * the trail of the last move, and the king in check.
 *
 * ⚠️ This REPLAYS the game, which the server deliberately never does. That is
 * not a contradiction: the server refuses to replay because it is on the hot
 * write path and a 60-move replay per request was a P0 of the red-team. Here it
 * runs on the client, once per position, purely to decide which two squares to
 * tint. Nothing about legality or the outcome depends on it.
 *
 * ⛔ And it must never throw. A history it cannot replay (drift, a duel seeded
 * from a FEN) costs the player a highlight, not their game.
 */

import { Chess } from "chess.js";

import type { DuelColor } from "./types";

export type DuelBoardView = {
  /** Squares of the move just played, for the trail the AI arena already draws. */
  lastMove: { from: string; to: string } | null;
  /** Where the king under check is standing, or `null`. */
  checkSquare: string | null;
};

const EMPTY: DuelBoardView = { lastMove: null, checkSquare: null };

export function duelBoardView(fen: string, moves: readonly string[]): DuelBoardView {
  return { lastMove: lastMoveOf(moves), checkSquare: checkSquareOf(fen) };
}

function lastMoveOf(moves: readonly string[]): { from: string; to: string } | null {
  if (moves.length === 0) return null;
  try {
    const game = new Chess();
    for (const san of moves) game.move(san);
    const history = game.history({ verbose: true });
    const last = history[history.length - 1] as { from?: string; to?: string } | undefined;
    if (!last?.from || !last?.to) return null;
    return { from: last.from, to: last.to };
  } catch {
    return null;
  }
}

/**
 * ⚠️ The king in check is the one of the side TO MOVE, not of whoever moved.
 * Reading it the other way round would tint the square of a king that is
 * perfectly safe, every single time a check is given.
 */
function checkSquareOf(fen: string): string | null {
  try {
    const game = new Chess(fen);
    if (!game.inCheck()) return null;

    const side = game.turn() as DuelColor;
    for (const row of game.board()) {
      for (const cell of row) {
        if (cell && cell.type === "k" && cell.color === side) return cell.square;
      }
    }
    return null;
  } catch {
    return EMPTY.checkSquare;
  }
}
