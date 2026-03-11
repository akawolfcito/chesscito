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

  const completeExercise = useCallback(
    (movesUsed: number) => {
      setProgress((prev) => {
        const stars = computeStars(movesUsed, currentExercise.optimalMoves);
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
    [currentExercise.optimalMoves]
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
      // Only allow navigating to completed exercises or the next unlocked one
      const highestUnlocked = prev.stars.findIndex((s) => s === 0);
      const maxAllowed = highestUnlocked === -1 ? EXERCISES_PER_PIECE - 1 : highestUnlocked;
      if (clamped > maxAllowed) return prev;
      const next: PieceProgress = { ...prev, exerciseIndex: clamped };
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
    completeExercise,
    advanceExercise,
    goToExercise,
  };
}
