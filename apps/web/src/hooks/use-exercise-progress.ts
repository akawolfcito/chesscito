"use client";

import { useCallback, useEffect, useState } from "react";
import { BADGE_THRESHOLD, EXERCISES, EXERCISES_PER_PIECE } from "@/lib/game/exercises";
import { computeStars, totalStars } from "@/lib/game/scoring";
import type { Exercise, PieceId, PieceProgress } from "@/lib/game/types";

const EMPTY_STARS: PieceProgress["stars"] = [0, 0, 0, 0, 0];

function storageKey(piece: PieceId) {
  return `chesscito:progress:${piece}`;
}

function loadProgress(piece: PieceId): PieceProgress {
  if (typeof window === "undefined") {
    return { piece, exerciseIndex: 0, stars: [...EMPTY_STARS] };
  }

  try {
    const raw = localStorage.getItem(storageKey(piece));
    if (raw) {
      const parsed = JSON.parse(raw) as PieceProgress;
      if (
        Array.isArray(parsed.stars) &&
        parsed.stars.length === EXERCISES_PER_PIECE &&
        typeof parsed.exerciseIndex === "number" &&
        parsed.exerciseIndex >= 0 &&
        parsed.exerciseIndex < EXERCISES_PER_PIECE
      ) {
        const validStars = parsed.stars.every(
          (s: unknown) => typeof s === "number" && s >= 0 && s <= 3
        );
        if (!validStars) {
          return { piece, exerciseIndex: 0, stars: [...EMPTY_STARS] };
        }
        return parsed;
      }
    }
  } catch {
    // ignore corrupt data
  }

  return { piece, exerciseIndex: 0, stars: [...EMPTY_STARS] };
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
  const [progress, setProgress] = useState<PieceProgress>({
    piece,
    exerciseIndex: 0,
    stars: [0, 0, 0, 0, 0],
  });

  useEffect(() => {
    setProgress(loadProgress(piece));
  }, [piece]);

  const currentExercise: Exercise = EXERCISES[piece][progress.exerciseIndex];
  const isLastExercise = progress.exerciseIndex === EXERCISES_PER_PIECE - 1;
  const total = totalStars(progress.stars);
  const badgeEarned = total >= BADGE_THRESHOLD;
  const isReplay = progress.stars[progress.exerciseIndex] > 0;

  const completeExercise = useCallback(
    (movesUsed: number) => {
      setProgress((prev) => {
        const exercise = EXERCISES[piece][prev.exerciseIndex];
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
      if (prev.exerciseIndex >= EXERCISES_PER_PIECE - 1) return prev;
      const next: PieceProgress = {
        ...prev,
        exerciseIndex: prev.exerciseIndex + 1,
      };
      saveProgress(next);
      return next;
    });
  }, []);

  const goToExercise = useCallback((index: number) => {
    setProgress((prev) => {
      const clamped = Math.max(0, Math.min(index, EXERCISES_PER_PIECE - 1));
      // Allow navigating to any completed exercise or one past the last completed
      const lastCompleted = prev.stars.reduce((acc, s, i) => (s > 0 ? i : acc), -1);
      const maxAllowed = Math.min(lastCompleted + 1, EXERCISES_PER_PIECE - 1);
      if (clamped > maxAllowed) return prev;
      const next: PieceProgress = { ...prev, exerciseIndex: clamped };
      saveProgress(next);
      return next;
    });
  }, []);

  const markCompleted = useCallback(() => {
    setProgress((prev) => {
      const next: PieceProgress = { ...prev, completed: true };
      saveProgress(next);
      return next;
    });
  }, []);

  return {
    progress,
    currentExercise,
    isLastExercise,
    totalStars: total,
    badgeEarned,
    isReplay,
    pieceCompleted: progress.completed ?? false,
    completeExercise,
    advanceExercise,
    goToExercise,
    markCompleted,
  };
}
