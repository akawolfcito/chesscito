import type { BoardPiece, BoardPosition, PieceId, SquareState } from "@/lib/game/types";
import { getBishopMoves } from "@/lib/game/rules/bishop";
import { getKnightMoves } from "@/lib/game/rules/knight";
import { getRookMoves } from "@/lib/game/rules/rook";

const BOARD_SIZE = 8;
const FILE_LABELS = ["a", "b", "c", "d", "e", "f", "g", "h"];

export function makePiece(type: PieceId, position: BoardPosition): BoardPiece {
  return { id: `${type}-1`, type, position };
}

export function arePositionsEqual(a: BoardPosition, b: BoardPosition) {
  return a.file === b.file && a.rank === b.rank;
}

export function isInsideBoard(position: BoardPosition) {
  return (
    position.file >= 0 &&
    position.file < BOARD_SIZE &&
    position.rank >= 0 &&
    position.rank < BOARD_SIZE
  );
}

export function getPositionLabel(position: BoardPosition) {
  return `${FILE_LABELS[position.file]}${position.rank + 1}`;
}

export function getValidTargets(
  pieceType: PieceId,
  position: BoardPosition,
  blockers: BoardPosition[] = []
): BoardPosition[] {
  switch (pieceType) {
    case "rook":   return getRookMoves(position, blockers);
    case "bishop": return getBishopMoves(position, blockers);
    case "knight": return getKnightMoves(position);
    default:       return [];
  }
}

export function movePiece(piece: BoardPiece, nextPosition: BoardPosition): BoardPiece {
  if (!isInsideBoard(nextPosition)) return piece;
  return { ...piece, position: nextPosition };
}

export function buildBoardSquares({
  selectedPosition,
  piece,
  validTargets,
  targetPosition = null,
}: {
  selectedPosition: BoardPosition | null;
  piece: BoardPiece;
  validTargets: BoardPosition[];
  targetPosition?: BoardPosition | null;
}): SquareState[] {
  const squares: SquareState[] = [];

  for (let rank = BOARD_SIZE - 1; rank >= 0; rank--) {
    for (let file = 0; file < BOARD_SIZE; file++) {
      const position = { file, rank };
      squares.push({
        file,
        rank,
        label: getPositionLabel(position),
        isDark: (file + rank) % 2 === 1,
        isHighlighted: validTargets.some((t) => arePositionsEqual(t, position)),
        isSelected: selectedPosition ? arePositionsEqual(selectedPosition, position) : false,
        isTarget: targetPosition ? arePositionsEqual(targetPosition, position) : false,
        piece: arePositionsEqual(piece.position, position) ? piece : null,
      });
    }
  }

  return squares;
}
