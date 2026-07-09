/**
 * Score arithmetic, shared by the client that computes a score and the
 * server that signs it.
 *
 * The two used to state the ceiling independently: `exercises-screen`
 * multiplied stars by 100, while `/api/sign-score` hardcoded a 1500 cap
 * described as "15 stars × 100 pts". That cap was the ceiling of a
 * 5-exercise pool. When the pools grew to 10, every player past 15★ began
 * getting a 400 on the on-chain save — the better the player, the more
 * certainly locked out. Deriving the ceiling from the catalog keeps the
 * bound honest as pools change.
 *
 * The cap is still a real anti-cheat bound: it rejects any score the
 * catalog cannot produce. It is just calibrated instead of guessed.
 */

import { EXERCISES, PLAYABLE_PIECES } from "@/lib/game/exercises";
import { getMaxPossibleStars } from "@/lib/game/progress-adapter";
import type { ExerciseCatalog } from "@/lib/game/rotation";
import type { PieceId } from "@/lib/game/types";

export const POINTS_PER_STAR = 100;

/** Highest score a perfect run on `piece` can produce. */
export function getMaxScoreForPiece(
  piece: PieceId,
  catalog: ExerciseCatalog = EXERCISES,
): number {
  return getMaxPossibleStars(piece, catalog) * POINTS_PER_STAR;
}

/**
 * Highest score ANY piece can produce — the bound `/api/sign-score` uses.
 * Per-piece would be tighter, but the route validates `score` before it
 * trusts `levelId` to name a piece, so the ceiling is taken across pieces.
 *
 * Reads the baseline catalog. A db-content overlay that grows a pool past
 * the baseline would need this recomputed server-side.
 */
export function getMaxSubmittableScore(
  catalog: ExerciseCatalog = EXERCISES,
): number {
  return Math.max(
    ...PLAYABLE_PIECES.map((piece) => getMaxScoreForPiece(piece, catalog)),
  );
}
