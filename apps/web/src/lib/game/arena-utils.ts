import { Chess } from "chess.js";
import { THEME_CONFIG } from "@/lib/theme";
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

const BASE = THEME_CONFIG.piecesBase;

/** All piece image paths keyed by color and ChessPieceId (theme-aware) */
export const ARENA_PIECE_IMG: Record<PieceColor, Record<ChessPieceId, string>> = {
  w: {
    pawn: `${BASE}/w-pawn.png`,
    knight: `${BASE}/w-knight.png`,
    bishop: `${BASE}/w-bishop.png`,
    rook: `${BASE}/w-rook.png`,
    queen: `${BASE}/w-queen.png`,
    king: `${BASE}/w-king.png`,
  },
  b: {
    pawn: `${BASE}/b-pawn.png`,
    knight: `${BASE}/b-knight.png`,
    bishop: `${BASE}/b-bishop.png`,
    rook: `${BASE}/b-rook.png`,
    queen: `${BASE}/b-queen.png`,
    king: `${BASE}/b-king.png`,
  },
};

/**
 * Convert a FEN string to an array of ChessBoardPiece.
 * Uses chess.js board() which returns an 8x8 grid.
 */
export function fenToPieces(fen: string): ChessBoardPiece[] {
  try {
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
  } catch {
    console.error("fenToPieces: invalid FEN", fen);
    return [];
  }
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

/**
 * Format milliseconds as m:ss string.
 * e.g. 75000 → "1:15"
 */
export function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}
