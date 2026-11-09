import { EXERCISES } from "@/lib/game/exercises";
import type { PieceId } from "@/lib/game/types";

/**
 * Seed persisted progress in the shape the app actually stores.
 *
 * Most of these suites used to seed the LEGACY positional shape
 * (`{ exerciseIndex, stars: [3, 3, 0] }`) simply because it was terser — they are
 * testing replay, telemetry and rotation, not migration. That shape no longer
 * credits stars (it is ambiguous after the A6 reorder; see
 * use-exercise-progress-resume.test.tsx), so seeding with it would silently give
 * every one of those tests a zero-star player and quietly stop testing anything.
 *
 * This keeps the terse positional call-site and writes the id-keyed record it
 * means: `stars[i]` belongs to `pool[i]`, resolved HERE, against the catalog the
 * test is running with — which is exactly the step the app can no longer do for
 * real legacy data, because it never recorded which pool the array was written
 * against.
 */
export function seedProgress(
  piece: PieceId,
  index: number,
  stars: number[],
): string {
  const pool = EXERCISES[piece];
  const starsById: Record<string, number> = {};
  stars.forEach((value, i) => {
    if (value > 0 && pool[i]) starsById[pool[i].id] = value;
  });
  return JSON.stringify({
    piece,
    currentId: pool[index]?.id ?? null,
    stars: starsById,
  });
}
