/**
 * The catalog slice the mini-games surface reads.
 *
 * WHY THIS EXISTS AS ITS OWN TYPE
 * -------------------------------
 * Every mini-games helper needs the same seven pools, and every one of them
 * must be injectable so the surface can read the merged (baseline ⊕ overlay)
 * catalog when `CONTENT_STAGE` is set and the compiled baseline otherwise —
 * the same contract `buildTrainingPath` already honours for lane 1.
 *
 * ⛔ Do NOT import `merged-catalog.ts` from here. That module pulls
 * `next/cache` and `getSupabaseServer`, which makes it server-only; the
 * mini-games helpers run on the client too. Callers hand the pools in.
 */

import {
  DIAGONAL_RUN,
  EXERCISES,
  KNIGHT_TOUR,
  LABYRINTHS,
  PROMOTION_RUN,
  QUEENS,
  SAFE_PATH,
} from "@/lib/game/exercises";
import type { CatalogPools } from "@/lib/content/merged-catalog";

export type MiniGamePools = CatalogPools;

/**
 * The compiled baseline as `MiniGamePools`.
 *
 * This is the DEFAULT every helper falls back to, and it is what tests read.
 * It is byte-identical to what the pre-overlay read path has always used.
 */
export function baselineMiniGamePools(): MiniGamePools {
  return {
    exercises: EXERCISES,
    labyrinths: LABYRINTHS,
    diagonalRun: DIAGONAL_RUN,
    knightTour: KNIGHT_TOUR,
    queens: QUEENS,
    safePath: SAFE_PATH,
    promotionRun: PROMOTION_RUN,
  };
}
