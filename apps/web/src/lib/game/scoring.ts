/**
 * Calcula estrellas según precisión (movimientos usados vs óptimos).
 *
 * 3★ → movesUsed <= optimalMoves
 * 2★ → movesUsed === optimalMoves + 1
 * 1★ → movesUsed >= optimalMoves + 2
 * 0★ → no completó (reset) — no llamar esta función en ese caso
 */
export function computeStars(
  movesUsed: number,
  optimalMoves: number
): 0 | 1 | 2 | 3 {
  if (movesUsed <= optimalMoves) return 3;
  if (movesUsed === optimalMoves + 1) return 2;
  return 1;
}

export function totalStars(stars: number[]): number {
  return stars.reduce((sum, s) => sum + s, 0);
}

/**
 * Endgame trainer stars — based on move count vs par budget.
 *
 * 3★ → moves <= 10           (theoretical optimal play)
 * 2★ → moves <= parMoves     (within budget — competent)
 * 1★ → moves > parMoves      (over budget but completed)
 * 0★ → caller handles drawn/no-win separately
 */
export function endgameStars(
  moves: number,
  parMoves: number,
): 0 | 1 | 2 | 3 {
  if (moves <= 10) return 3;
  if (moves <= parMoves) return 2;
  return 1;
}
