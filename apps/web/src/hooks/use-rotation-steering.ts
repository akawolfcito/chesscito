"use client";

import { useEffect } from "react";
import { EXERCISES } from "@/lib/game/exercises";
import type { PieceId } from "@/lib/game/types";

export type RotationSteeringOptions = {
  /** Rotation engine flag (ENABLE_EXERCISE_ROTATION at the callsite;
   *  injected so tests can exercise both paths). */
  enabled: boolean;
  /** Today's visible exercise ids, or null when rotation is off. */
  visibleExerciseIds: Set<string> | null;
  currentExerciseId: string;
  piece: PieceId;
  /** id-keyed best-stars map for the piece (PieceProgress.stars). Sparse:
   *  an absent id means "not played yet" (read as `?? 0`). */
  stars: Record<string, number>;
  /** Rotation-relaxed navigation from useExerciseProgress. */
  goToExercise: (index: number) => void;
  /** Spec B8 / red-team P0-2: while the labyrinth layer is active,
   *  steering must NOT yank the player back to an exercise. The
   *  callsite passes `labyrinthMode`; suspension resumes (and the
   *  effect re-evaluates) as soon as the player leaves the layer. */
  suspended: boolean;
};

/**
 * Steers the active board exercise into today's visible set when
 * rotation is on and the persisted exerciseIndex points outside it
 * (e.g. a returning player whose last slot isn't in today's set).
 * Targets the first incomplete visible exercise, else the first
 * visible one. Uses the rotation-relaxed goToExercise, so it can only
 * land on visible-set members. No-op when the current exercise is
 * already visible.
 *
 * Extracted from exercises-screen.tsx (Slice 3B) so the labyrinth
 * suspension is unit-testable instead of living untested in the
 * monolith. Logic is byte-equivalent to the inline effect it replaces,
 * plus the `suspended` early return.
 */
export function useRotationSteering({
  enabled,
  visibleExerciseIds,
  currentExerciseId,
  piece,
  stars,
  goToExercise,
  suspended,
}: RotationSteeringOptions): void {
  useEffect(() => {
    if (suspended) return;
    if (!enabled || !visibleExerciseIds) return;
    if (visibleExerciseIds.size === 0) return;
    if (visibleExerciseIds.has(currentExerciseId)) return;
    const pool = EXERCISES[piece];
    const firstIncomplete = pool.findIndex(
      (ex) => visibleExerciseIds.has(ex.id) && (stars[ex.id] ?? 0) === 0,
    );
    const target =
      firstIncomplete >= 0
        ? firstIncomplete
        : pool.findIndex((ex) => visibleExerciseIds.has(ex.id));
    if (target >= 0) goToExercise(target);
  }, [
    suspended,
    enabled,
    visibleExerciseIds,
    currentExerciseId,
    piece,
    stars,
    goToExercise,
  ]);
}
