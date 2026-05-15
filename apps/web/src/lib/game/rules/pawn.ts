import type { BoardPosition } from "../types";

/**
 * Pawn moves for Practice exercises (white, moves up the board).
 *
 * Movement and capture are SEPARATE for the Pawn:
 * - Movement: forward only (1 square, or 2 from starting rank)
 * - Capture: diagonally forward (1 square, left or right)
 *
 * Diagonal squares are ONLY included when `isCapture` is true,
 * teaching the correct rule: pawns cannot move diagonally
 * unless capturing.
 */
export function getPawnMoves(
  origin: BoardPosition,
  blockers: BoardPosition[] = [],
  isCapture: boolean = false,
  captureSquares?: BoardPosition[],
): BoardPosition[] {
  const moves: BoardPosition[] = [];
  const isBlocked = (f: number, r: number) =>
    blockers.some((b) => b.file === f && b.rank === r);

  // Forward 1
  const fwd1 = { file: origin.file, rank: origin.rank + 1 };
  if (fwd1.rank < 8 && !isBlocked(fwd1.file, fwd1.rank)) {
    moves.push(fwd1);

    // Forward 2 (only from starting rank 1, and only if forward-1 was clear)
    if (origin.rank === 1) {
      const fwd2 = { file: origin.file, rank: origin.rank + 2 };
      if (fwd2.rank < 8 && !isBlocked(fwd2.file, fwd2.rank)) {
        moves.push(fwd2);
      }
    }
  }

  // Diagonal captures — only in capture exercises
  if (isCapture) {
    const canCapture = (f: number, r: number) =>
      captureSquares === undefined
        || captureSquares.some((s) => s.file === f && s.rank === r);

    for (const df of [-1, 1]) {
      const diag = { file: origin.file + df, rank: origin.rank + 1 };
      if (diag.file >= 0 && diag.file < 8 && diag.rank < 8) {
        if (canCapture(diag.file, diag.rank)) {
          moves.push(diag);
        }
      }
    }
  }

  return moves;
}
