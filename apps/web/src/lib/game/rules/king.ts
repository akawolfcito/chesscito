import type { BoardPosition } from "../types";

const KING_DELTAS = [
  { file: 0, rank: 1 },
  { file: 0, rank: -1 },
  { file: 1, rank: 0 },
  { file: -1, rank: 0 },
  { file: 1, rank: 1 },
  { file: 1, rank: -1 },
  { file: -1, rank: 1 },
  { file: -1, rank: -1 },
];

function samePosition(a: BoardPosition, b: BoardPosition) {
  return a.file === b.file && a.rank === b.rank;
}

/** One-square moves of the king in any of the 8 directions. Blockers
 *  (friendly labyrinth pieces) are skipped; threats are NOT modeled in
 *  v0.1 — see docs/superpowers/specs/2026-06-02-training-content-v0.1.md §12.
 */
export function getKingMoves(
  origin: BoardPosition,
  blockers: BoardPosition[] = []
): BoardPosition[] {
  return KING_DELTAS
    .map((d) => ({ file: origin.file + d.file, rank: origin.rank + d.rank }))
    .filter((p) => p.file >= 0 && p.file < 8 && p.rank >= 0 && p.rank < 8)
    .filter((p) => !blockers.some((b) => samePosition(b, p)));
}
