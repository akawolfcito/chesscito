import type { BoardPosition, PieceId } from "@/lib/game/types";

const PIECE_LETTER: Record<PieceId, string> = {
  king: "K",
  queen: "Q",
  rook: "R",
  bishop: "B",
  knight: "N",
  pawn: "P",
};

/**
 * Render a single white piece on an empty 8×8 board as FEN (board part
 * only). Play-hub exercises are single-piece puzzles so the FEN stays
 * minimal — `/api/og/invite` renders it through BoardRender the same
 * way full-game FENs are handled for arena shares.
 */
export function buildExerciseFen(piece: PieceId, startPos: BoardPosition): string {
  const letter = PIECE_LETTER[piece];
  // FEN rows go top (rank 8) to bottom (rank 1). Our BoardPosition uses
  // rank 0 = rank 1, so the piece's FEN row is (7 - startPos.rank).
  const pieceRow = 7 - startPos.rank;
  const f = startPos.file;
  const left = f === 0 ? "" : String(f);
  const right = f === 7 ? "" : String(7 - f);
  const pieceRowStr = left + letter + right;

  const rows: string[] = [];
  for (let i = 0; i < 8; i++) {
    rows.push(i === pieceRow ? pieceRowStr : "8");
  }
  return rows.join("/");
}

/** Convert BoardPosition to algebraic notation (e.g. {file:0,rank:0} → "a1"). */
export function toAlgebraic(pos: BoardPosition): string {
  return "abcdefgh"[pos.file] + String(pos.rank + 1);
}
