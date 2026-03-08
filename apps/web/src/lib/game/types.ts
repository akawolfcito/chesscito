export type PieceId = "rook" | "bishop" | "knight";

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
  isSelected: boolean;
  isTarget: boolean;
  piece: BoardPiece | null;
};

export type Exercise = {
  id: string;
  startPos: BoardPosition;   // posición inicial de la pieza
  targetPos: BoardPosition;  // casilla objetivo
  optimalMoves: number;      // mínimo teórico de movimientos
};

export type PieceProgress = {
  piece: PieceId;
  exerciseIndex: number;     // índice del ejercicio activo (0–4)
  stars: [number, number, number, number, number]; // 0–3 por ejercicio
};
