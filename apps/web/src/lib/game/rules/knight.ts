import type { BoardPosition } from "../types";

const KNIGHT_DELTAS = [
  { file: 2, rank: 1 }, { file: 2, rank: -1 },
  { file: -2, rank: 1 }, { file: -2, rank: -1 },
  { file: 1, rank: 2 }, { file: 1, rank: -2 },
  { file: -1, rank: 2 }, { file: -1, rank: -2 },
];

/** Saltos válidos del caballo desde `origin` (1 movimiento) */
export function getKnightMoves(origin: BoardPosition): BoardPosition[] {
  return KNIGHT_DELTAS.map((d) => ({
    file: origin.file + d.file,
    rank: origin.rank + d.rank,
  })).filter((p) => p.file >= 0 && p.file < 8 && p.rank >= 0 && p.rank < 8);
}
