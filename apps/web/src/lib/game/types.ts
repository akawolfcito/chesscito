export type PieceId = "rook" | "bishop" | "knight" | "pawn" | "queen" | "king";

export type BoardPosition = {
  file: number; // 0=a … 7=h
  rank: number; // 0=1 … 7=8
};

export type BoardPiece = {
  id: string;
  type: PieceId;
  position: BoardPosition;
};

export type SquareState = {
  file: number;
  rank: number;
  label: string;
  isDark: boolean;
  isHighlighted: boolean;
  isEndpoint: boolean;
  isSelected: boolean;
  isTarget: boolean;
  piece: BoardPiece | null;
};

export type Exercise = {
  id: string;
  startPos: BoardPosition;   // posición inicial de la pieza
  targetPos: BoardPosition;  // casilla objetivo
  optimalMoves: number;      // mínimo teórico de movimientos
  isCapture?: boolean;
  /** L2 labyrinth obstacles — friendly blocker pieces that the player's
   *  piece cannot move through or capture. Sliding pieces (rook, bishop,
   *  queen) stop one square before an obstacle in the line of attack.
   *  When set, the exercise is treated as labyrinth mode. */
  obstacles?: BoardPosition[];
};

export type LabyrinthProgress = {
  piece: PieceId;
  /** Best (minimum) move count achieved across attempts per labyrinth.
   *  null until first completion. */
  bestMoves: Record<string, number | null>;
  /** Stars earned per labyrinth (0–3). Stars are recomputed when a new
   *  best is recorded. */
  stars: Record<string, number>;
};

export type PieceProgress = {
  piece: PieceId;
  exerciseIndex: number;     // índice del ejercicio activo (0–4)
  stars: [number, number, number, number, number]; // 0–3 por ejercicio
};

/* ── Arena (full chess) types ── */

export type ChessPieceId = PieceId;

export type PieceColor = "w" | "b";

export type ChessBoardPiece = {
  /** Stable identity that survives moves — used as React key to keep CSS
   *  transitions attached to the same DOM node when pieces re-sort. */
  id: string;
  type: ChessPieceId;
  color: PieceColor;
  square: string; // algebraic notation, e.g. "e4"
};

export type ArenaDifficulty = "easy" | "medium" | "hard";

export type ArenaStatus =
  | "selecting"
  | "playing"
  | "checkmate"
  | "stalemate"
  | "draw"
  | "resigned";
