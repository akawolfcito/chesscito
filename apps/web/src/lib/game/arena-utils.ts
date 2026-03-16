import { Chess } from "chess.js";
import type { ChessBoardPiece, ChessPieceId, PieceColor } from "./types";

/** Map chess.js single-char piece types to our ChessPieceId */
const PIECE_MAP: Record<string, ChessPieceId> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};

/** All piece image paths keyed by ChessPieceId */
export const ARENA_PIECE_IMG: Record<ChessPieceId, string> = {
  pawn: "/art/piece-pawn.png",
  knight: "/art/piece-knight.png",
  bishop: "/art/piece-bishop.png",
  rook: "/art/piece-rook.png",
  queen: "/art/piece-queen.png",
  king: "/art/piece-king.png",
};

/**
 * Convert a FEN string to an array of ChessBoardPiece.
 * Uses chess.js board() which returns an 8x8 grid.
 */
export function fenToPieces(fen: string): ChessBoardPiece[] {
  const game = new Chess(fen);
  const board = game.board();
  const pieces: ChessBoardPiece[] = [];

  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const cell = board[rank][file];
      if (cell) {
        const fileChar = String.fromCharCode(97 + file);
        const rankNum = 8 - rank;
        pieces.push({
          type: PIECE_MAP[cell.type],
          color: cell.color as PieceColor,
          square: `${fileChar}${rankNum}`,
        });
      }
    }
  }

  return pieces;
}

/**
 * Convert algebraic square notation to file/rank indices.
 * "e4" → { file: 4, rank: 3 }
 */
export function squareToFileRank(square: string): { file: number; rank: number } {
  return {
    file: square.charCodeAt(0) - 97,
    rank: Number(square[1]) - 1,
  };
}
