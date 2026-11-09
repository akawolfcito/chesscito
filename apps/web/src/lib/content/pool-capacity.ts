/**
 * Pool capacity for the content builder.
 *
 * `/api/sign-score` validates a submitted score against `MAX_SUBMITTABLE_SCORE`,
 * which is priced from `MAX_EXERCISES_PER_PIECE`. Nothing stopped the builder
 * from growing a piece's pool past that: the overlay appends exercises live,
 * and the guard test in `score.test.ts` only inspects the BASELINE catalog. A
 * piece grown past the invariant through the builder would have silently
 * reproduced the 400 that broke on-chain saves — for the player, not the author.
 *
 * So the refusal belongs here, at the write. Rejecting the author is cheap: he
 * sees the message and adjusts. Rejecting the player is an incident.
 *
 * Only exercises are capped. Labyrinths do not feed the score (`labyrinthStars`
 * writes to `recordLabyrinthBest`, never to `progress.stars`).
 */

import { EXERCISES } from "@/lib/game/exercises";
import { MAX_EXERCISES_PER_PIECE } from "@/lib/game/score";
import type { ExerciseCatalog } from "@/lib/game/rotation";
import type { PieceId } from "@/lib/game/types";

export type PoolCapacityInput = {
  piece: PieceId;
  /** id of the exercise being written. */
  recordId: string;
  /** true when this write disables (removes) the exercise. */
  disabled: boolean;
  /** ids of the ENABLED exercise overlay rows already stored for this piece. */
  overlayIds: readonly string[];
  /** Defaults to the score invariant — the two must never drift apart. */
  cap?: number;
  baseline?: ExerciseCatalog;
};

/**
 * Size of the merged pool once this write lands. The overlay replaces a
 * baseline exercise when ids collide and appends otherwise, so the projection
 * is a set union — never a sum.
 */
export function projectedPoolSize({
  piece,
  recordId,
  disabled,
  overlayIds,
  baseline = EXERCISES,
}: PoolCapacityInput): number {
  const ids = new Set<string>(baseline[piece].map((exercise) => exercise.id));
  for (const id of overlayIds) ids.add(id);

  if (disabled) ids.delete(recordId);
  else ids.add(recordId);

  return ids.size;
}

/**
 * True when this write must be refused. A write that SHRINKS the pool is always
 * allowed, so an author who somehow lands over the cap can still dig out.
 */
export function exceedsPoolCap(input: PoolCapacityInput): boolean {
  if (input.disabled) return false;

  const cap = input.cap ?? MAX_EXERCISES_PER_PIECE;
  return projectedPoolSize(input) > cap;
}
