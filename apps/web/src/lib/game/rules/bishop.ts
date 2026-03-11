import type { BoardPosition } from "../types";

function samePosition(a: BoardPosition, b: BoardPosition) {
  return a.file === b.file && a.rank === b.rank;
}

/** Todas las casillas alcanzables por el alfil desde `origin` en 1 movimiento */
export function getBishopMoves(
  origin: BoardPosition,
  blockers: BoardPosition[] = []
): BoardPosition[] {
  const directions = [
    { file: 1, rank: 1 },
    { file: 1, rank: -1 },
    { file: -1, rank: 1 },
    { file: -1, rank: -1 },
  ];

  const moves: BoardPosition[] = [];

  for (const dir of directions) {
    let f = origin.file + dir.file;
    let r = origin.rank + dir.rank;

    while (f >= 0 && f < 8 && r >= 0 && r < 8) {
      const pos = { file: f, rank: r };

      if (blockers.some((b) => samePosition(b, pos))) break;

      moves.push(pos);
      f += dir.file;
      r += dir.rank;
    }
  }

  return moves;
}

