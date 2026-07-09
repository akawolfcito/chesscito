/**
 * Reads a piece's persisted progress into a positional stars array, in
 * current catalog order and always of pool length.
 *
 * Tolerates both storage shapes: the legacy positional `stars: number[]`
 * and the id-keyed `stars: Record<exerciseId, stars>` written since the
 * Exercises-Builder migration (2026-06-16). Callers that only handled the
 * array shape silently scored every piece at 0★ — which is what hid the
 * badge Claim CTA. `use-hub-data.ts` grew its own tolerant reader for the
 * same reason; this module is the shared, catalog-aware version.
 */

import { EXERCISES } from "@/lib/game/exercises";
import {
  migrateStarsArrayToIdMap,
  starsIdMapToArray,
  type ExerciseStarsById,
} from "@/lib/game/progress-adapter";
import type { ExerciseCatalog } from "@/lib/game/rotation";
import type { PieceId } from "@/lib/game/types";

function zeroed(piece: PieceId, catalog: ExerciseCatalog): number[] {
  return catalog[piece].map(() => 0);
}

export function parsePieceStars(
  raw: string | null,
  piece: PieceId,
  catalog: ExerciseCatalog = EXERCISES,
): number[] {
  if (!raw) return zeroed(piece, catalog);

  try {
    const stars: unknown = JSON.parse(raw)?.stars;

    if (Array.isArray(stars)) {
      return starsIdMapToArray(
        piece,
        migrateStarsArrayToIdMap(piece, stars, catalog),
        catalog,
      );
    }

    if (stars && typeof stars === "object") {
      return starsIdMapToArray(piece, stars as ExerciseStarsById, catalog);
    }

    return zeroed(piece, catalog);
  } catch {
    return zeroed(piece, catalog);
  }
}
