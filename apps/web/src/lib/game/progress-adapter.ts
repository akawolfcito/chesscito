/**
 * Rotation Engine — dual progress adapter (slice C, 2026-06-08).
 *
 * Bridges the legacy positional progress (`stars: number[]`, indexed by
 * catalog position) and the forward order-independent model
 * (`ExerciseStarsById = Record<exerciseId, stars>`). Pure + non-
 * destructive: no React, no localStorage, no network, no input mutation.
 * This slice ONLY adds the adapter; it does NOT change the progress hook,
 * persistence, badge claim, or any visible behaviour.
 *
 * Why id-map: the catalog array is positional and FROZEN — reordering it
 * remaps live progress (proven by the King append-only milestone). Keyed
 * by exerciseId, progress becomes immune to future reordering. The
 * adapter migrates legacy arrays in by current catalog order, after which
 * the id-map is the safe source of truth.
 *
 * Plan: docs/product/chesscito-rotation-engine-calibration-2026-06-08.md.
 */

import { EXERCISES } from "@/lib/game/exercises";
import {
  getPieceMasteryStars,
  type ExerciseCatalog,
  type ExerciseStarsById,
} from "@/lib/game/rotation";
import type { PieceId } from "@/lib/game/types";

export type { ExerciseStarsById } from "@/lib/game/rotation";

/** Coerce any value into a valid star count: non-numbers and NaN → 0,
 *  clamp to [0, 3], round fractional values to the nearest integer. */
function clampStars(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 3) return 3;
  return Math.round(value);
}

/**
 * Legacy `stars[]` → id-map, mapping by CURRENT catalog order.
 * Produces a full map (one entry per pool exercise):
 *  - shorter array → missing trailing exercises padded with 0;
 *  - longer array  → extra entries ignored (truncated to pool length);
 *  - each value clamped/coerced.
 * Does not mutate the input array.
 */
export function migrateStarsArrayToIdMap(
  piece: PieceId,
  starsArray: readonly number[],
  catalog: ExerciseCatalog = EXERCISES,
): ExerciseStarsById {
  const pool = catalog[piece];
  const out: ExerciseStarsById = {};
  for (let i = 0; i < pool.length; i += 1) {
    out[pool[i].id] = clampStars(starsArray[i]);
  }
  return out;
}

/**
 * id-map → legacy `stars[]`, in CURRENT catalog order. Missing ids → 0,
 * each value clamped. Length always equals the piece pool length. Does
 * not mutate the input map.
 */
export function starsIdMapToArray(
  piece: PieceId,
  starsById: ExerciseStarsById,
  catalog: ExerciseCatalog = EXERCISES,
): number[] {
  return catalog[piece].map((ex) => clampStars(starsById[ex.id]));
}

/**
 * Canonical id-map for a piece: one clamped entry per pool exercise.
 * Unknown ids in the input are discarded; missing ids are filled with 0.
 * Does not mutate the input.
 */
export function normalizeStarsById(
  piece: PieceId,
  starsById: ExerciseStarsById,
  catalog: ExerciseCatalog = EXERCISES,
): ExerciseStarsById {
  const out: ExerciseStarsById = {};
  for (const ex of catalog[piece]) {
    out[ex.id] = clampStars(starsById[ex.id]);
  }
  return out;
}

/** Best stars for a single exercise (clamped). Missing → 0. */
export function getStarsForExercise(
  starsById: ExerciseStarsById,
  exerciseId: string,
): number {
  return clampStars(starsById[exerciseId]);
}

/** Returns a NEW map with `exerciseId` set to the clamped value. Never
 *  mutates the input map. */
export function setStarsForExercise(
  starsById: ExerciseStarsById,
  exerciseId: string,
  stars: number,
): ExerciseStarsById {
  return { ...starsById, [exerciseId]: clampStars(stars) };
}

/** Total best stars across the pool from an id-map (across-pool mastery).
 *  Normalizes first so non-numbers/unknown ids can't skew the sum, then
 *  delegates to the single mastery implementation in rotation.ts. */
export function calculateTotalStarsFromIdMap(
  piece: PieceId,
  starsById: ExerciseStarsById,
  catalog: ExerciseCatalog = EXERCISES,
): number {
  return getPieceMasteryStars(
    piece,
    normalizeStarsById(piece, starsById, catalog),
    catalog,
  );
}

/** Maximum stars achievable for a piece: pool size × 3 (each exercise caps at 3★).
 *  Labyrinths are NOT included — they have a separate tracking system. */
export function getMaxPossibleStars(
  piece: PieceId,
  catalog: ExerciseCatalog = EXERCISES,
): number {
  return catalog[piece].length * 3;
}

/** Across-pool mastery from a legacy positional stars array — the
 *  array-input sibling of {@link calculateTotalStarsFromIdMap}. Bridges
 *  the legacy `stars: number[]` to the id-map mastery helper so callers
 *  that still hold the array (e.g. the progress hook's badge gate) make
 *  the across-pool semantics explicit. Equivalent to summing valid
 *  in-range stars; values are clamped to [0,3] per id via the adapter. */
export function calculatePoolMasteryFromArray(
  piece: PieceId,
  starsArray: readonly number[],
  catalog: ExerciseCatalog = EXERCISES,
): number {
  return getPieceMasteryStars(
    piece,
    migrateStarsArrayToIdMap(piece, starsArray, catalog),
    catalog,
  );
}
