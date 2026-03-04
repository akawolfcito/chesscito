import type { BoardPiece, BoardPosition, SquareState } from "@/lib/game/types";

const BOARD_SIZE = 8;
const FILE_LABELS = ["a", "b", "c", "d", "e", "f", "g", "h"];

export const INITIAL_ROOK: BoardPiece = {
  id: "rook-1",
  type: "rook",
  position: { file: 0, rank: 0 },
};

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

export function getRookTargets(position: BoardPosition) {
  const targets: BoardPosition[] = [];

  for (let file = 0; file < BOARD_SIZE; file += 1) {
    if (file !== position.file) {
      targets.push({ file, rank: position.rank });
    }
  }

  for (let rank = 0; rank < BOARD_SIZE; rank += 1) {
    if (rank !== position.rank) {
      targets.push({ file: position.file, rank });
    }
  }

  return targets;
}

export function movePiece(piece: BoardPiece, nextPosition: BoardPosition): BoardPiece {
  if (!isInsideBoard(nextPosition)) {
    return piece;
  }

  return {
    ...piece,
    position: nextPosition,
  };
}

export function buildBoardSquares({
  selectedPosition,
  piece,
  validTargets,
}: {
  selectedPosition: BoardPosition | null;
  piece: BoardPiece;
  validTargets: BoardPosition[];
}): SquareState[] {
  const squares: SquareState[] = [];

  for (let rank = BOARD_SIZE - 1; rank >= 0; rank -= 1) {
    for (let file = 0; file < BOARD_SIZE; file += 1) {
      const position = { file, rank };
      const hasPiece = arePositionsEqual(piece.position, position);

      squares.push({
        file,
        rank,
        label: getPositionLabel(position),
        isDark: (file + rank) % 2 === 1,
        isHighlighted: validTargets.some((target) => arePositionsEqual(target, position)),
        isSelected: selectedPosition ? arePositionsEqual(selectedPosition, position) : false,
        piece: hasPiece ? piece : null,
      });
    }
  }

  return squares;
}
