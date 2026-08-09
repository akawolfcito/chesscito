"use client";

import { useEffect } from "react";
import { useExerciseCatalog } from "@/lib/content/catalog-context";
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
  // Phase 2b-2: read the active pool from the catalog context (baseline
  // EXERCISES when no provider is mounted → byte-identical flag-off).
  const catalog = useExerciseCatalog();
  useEffect(() => {
    if (suspended) return;
    if (!enabled || !visibleExerciseIds) return;
    if (visibleExerciseIds.size === 0) return;
    if (visibleExerciseIds.has(currentExerciseId)) return;
    /* ⛔ Never evict a player from an exercise they already SOLVED. Steering
     * exists for the returning player whose stale slot points at content
     * today's rotation does not offer — not to undo a replay the player just
     * chose on purpose.
     *
     * This was the second half of the same disagreement `goToExercise` had
     * with the drawer (2026-08-08): even once navigation allowed a solved
     * exercise through, this effect yanked the player straight back out and
     * PERSISTED it, so the two fixes only work as a pair. */
    if ((stars[currentExerciseId] ?? 0) > 0) return;
    const pool = catalog[piece];
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
    catalog,
  ]);
}
