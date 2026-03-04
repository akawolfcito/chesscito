import type { BoardPiece, BoardPosition } from "../types";

function samePosition(a: BoardPosition, b: BoardPosition) {
  return a.file === b.file && a.rank === b.rank;
}

function sortByDistance(origin: BoardPosition, positions: BoardPosition[]) {
  return [...positions].sort((left, right) => {
    const leftDistance = Math.abs(left.file - origin.file) + Math.abs(left.rank - origin.rank);
    const rightDistance = Math.abs(right.file - origin.file) + Math.abs(right.rank - origin.rank);

    return leftDistance - rightDistance;
  });
}

export function getRookMoves(
  origin: BoardPosition,
  blockers: BoardPosition[] = []
): BoardPosition[] {
  const directions = [
    { file: 1, rank: 0 },
    { file: -1, rank: 0 },
    { file: 0, rank: 1 },
    { file: 0, rank: -1 },
  ];

  const moves: BoardPosition[] = [];

  for (const direction of directions) {
    let file = origin.file + direction.file;
    let rank = origin.rank + direction.rank;

    while (file >= 0 && file < 8 && rank >= 0 && rank < 8) {
      const position = { file, rank };

      if (blockers.some((blocker) => samePosition(blocker, position))) {
        break;
      }

      moves.push(position);
      file += direction.file;
      rank += direction.rank;
    }
  }

  return sortByDistance(origin, moves);
}

export function canRookMoveTo(
  origin: BoardPosition,
  target: BoardPosition,
  blockers: BoardPosition[] = []
) {
  return getRookMoves(origin, blockers).some((move) => samePosition(move, target));
}

export function getBlockersForPiece(piece: BoardPiece, pieces: BoardPiece[]) {
  return pieces
    .filter((candidate) => candidate.id !== piece.id)
    .map((candidate) => candidate.position);
}
