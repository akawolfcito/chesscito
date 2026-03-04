export type PieceId = "rook";

export type BoardPosition = {
  file: number;
  rank: number;
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
  piece: BoardPiece | null;
};
