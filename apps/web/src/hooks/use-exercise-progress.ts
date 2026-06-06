"use client";

import { useCallback, useEffect, useState } from "react";
import { BADGE_THRESHOLD, EXERCISES, getExerciseCount } from "@/lib/game/exercises";
import { computeStars, totalStars } from "@/lib/game/scoring";
import type { Exercise, PieceId, PieceProgress } from "@/lib/game/types";

/**
 * Returns a zero-filled stars array matching the piece's current pool
 * length. Replaces the legacy module-level `EMPTY_STARS = [0,0,0,0,0]`
 * constant — per-piece dynamic since Sprint 1 of Training Economy
 * Alpha (2026-06-05) when piece pools became variable-length.
 */
function emptyStars(piece: PieceId): number[] {
  return new Array(getExerciseCount(piece)).fill(0);
}

/**
 * Migrate a persisted `stars` array to match the current piece pool
 * length. Pure function — no localStorage, no piece coupling. Exported
 * to enable focused testing of the migration logic.
 *
 * Three cases:
 *  - `stars.length === count` → no-op, no mutation flag.
 *  - `stars.length < count`   → pad RIGHT with zeros, preserving every
 *    legacy value. The new exercises (those added to the pool after
 *    the user's last persist) are simply "not played yet".
 *  - `stars.length > count`   → preserve the FIRST `count` values and
 *    truncate the rest. Signals `truncated: true` so the caller can
 *    log a console warning. This case happens when a piece pool shrunk
 *    (rare in production; mostly a dev/migration accident). We do NOT
 *    silently reset to fresh because that throws away all progress.
 *
 * Returns a NEW array even when no mutation happens, so callers don't
 * accidentally mutate the persisted shape.
 */
export function migrateStarsLength(
  stars: readonly number[],
  count: number,
): { stars: number[]; mutated: boolean; truncated: boolean } {
  if (stars.length === count) {
    return { stars: [...stars], mutated: false, truncated: false };
  }
  if (stars.length < count) {
    const padded = [
      ...stars,
      ...new Array(count - stars.length).fill(0),
    ];
    return { stars: padded, mutated: true, truncated: false };
  }
  return {
    stars: stars.slice(0, count),
    mutated: true,
    truncated: true,
  };
}

function storageKey(piece: PieceId) {
  return `chesscito:progress:${piece}`;
}

function loadProgress(piece: PieceId): PieceProgress {
  if (typeof window === "undefined") {
    return { piece, exerciseIndex: 0, stars: emptyStars(piece) };
  }

  const count = getExerciseCount(piece);
  try {
    const raw = localStorage.getItem(storageKey(piece));
    if (!raw) {
      return { piece, exerciseIndex: 0, stars: emptyStars(piece) };
    }
    const parsed = JSON.parse(raw) as PieceProgress;
    if (
      !Array.isArray(parsed.stars) ||
      typeof parsed.exerciseIndex !== "number"
    ) {
      return { piece, exerciseIndex: 0, stars: emptyStars(piece) };
    }
    const validStars = parsed.stars.every(
      (s: unknown) => typeof s === "number" && s >= 0 && s <= 3,
    );
    if (!validStars) {
      return { piece, exerciseIndex: 0, stars: emptyStars(piece) };
    }
    const migration = migrateStarsLength(parsed.stars, count);
    if (migration.truncated) {
      // eslint-disable-next-line no-console
      console.warn(
        `[useExerciseProgress] stars length for piece "${piece}" exceeds current pool (got ${parsed.stars.length}, count ${count}). Preserving first ${count} entries; entries beyond have been discarded.`,
      );
    }
    const clampedIndex = Math.max(0, Math.min(parsed.exerciseIndex, count - 1));
    const result: PieceProgress = {
      piece,
      exerciseIndex: clampedIndex,
      stars: migration.stars,
    };
    if (migration.mutated || clampedIndex !== parsed.exerciseIndex) {
      saveProgress(result);
    }
    return result;
  } catch {
    return { piece, exerciseIndex: 0, stars: emptyStars(piece) };
  }
}

function saveProgress(progress: PieceProgress) {
  try {
    localStorage.setItem(storageKey(progress.piece), JSON.stringify(progress));
  } catch {
    // ignore storage errors
  }
}

export function useExerciseProgress(piece: PieceId) {
  // Inicializar siempre con defaults para que server y cliente rendericen igual
  // (evita hydration mismatch). localStorage se lee después del montaje.
  // Lazy initializer porque emptyStars depende del piece — evita recomputar
  // en cada render y mantiene compatibilidad SSR/CSR.
  const [progress, setProgress] = useState<PieceProgress>(() => ({
    piece,
    exerciseIndex: 0,
    stars: emptyStars(piece),
  }));

  useEffect(() => {
    setProgress(loadProgress(piece));
  }, [piece]);

  const count = getExerciseCount(piece);
  const safeIndex = Math.min(Math.max(0, progress.exerciseIndex), count - 1);
  const currentExercise: Exercise = EXERCISES[piece][safeIndex];
  const isLastExercise = progress.exerciseIndex === count - 1;
  const total = totalStars(progress.stars);
  const badgeEarned = total >= BADGE_THRESHOLD;
  const isReplay = progress.stars[progress.exerciseIndex] > 0;

  const completeExercise = useCallback(
    (movesUsed: number) => {
      setProgress((prev) => {
        const pieceCount = getExerciseCount(piece);
        const idx = Math.min(Math.max(0, prev.exerciseIndex), pieceCount - 1);
        const exercise = EXERCISES[piece][idx];
        const stars = computeStars(movesUsed, exercise.optimalMoves);
        const newStars = [...prev.stars] as PieceProgress["stars"];
        newStars[prev.exerciseIndex] = Math.max(
          newStars[prev.exerciseIndex],
          stars
        ) as 0 | 1 | 2 | 3;

        const next: PieceProgress = { ...prev, stars: newStars };
        saveProgress(next);
        return next;
      });
    },
    [piece]
  );

  const advanceExercise = useCallback(() => {
    setProgress((prev) => {
      const pieceCount = getExerciseCount(piece);
      if (prev.exerciseIndex >= pieceCount - 1) return prev;
      const next: PieceProgress = {
        ...prev,
        exerciseIndex: prev.exerciseIndex + 1,
      };
      saveProgress(next);
      return next;
    });
  }, [piece]);

  const goToExercise = useCallback((index: number) => {
    setProgress((prev) => {
      const pieceCount = getExerciseCount(piece);
      const clamped = Math.max(0, Math.min(index, pieceCount - 1));
      // Allow navigating to any completed exercise or one past the last completed
      const lastCompleted = prev.stars.reduce((acc, s, i) => (s > 0 ? i : acc), -1);
      const maxAllowed = Math.min(lastCompleted + 1, pieceCount - 1);
      if (clamped > maxAllowed) return prev;
      const next: PieceProgress = { ...prev, exerciseIndex: clamped };
      saveProgress(next);
      return next;
    });
  }, [piece]);

  return {
    progress,
    currentExercise,
    isLastExercise,
    totalStars: total,
    badgeEarned,
    isReplay,
    completeExercise,
    advanceExercise,
    goToExercise,
  };
}
