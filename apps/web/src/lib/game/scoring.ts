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
