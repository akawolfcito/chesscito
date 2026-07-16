"use client";

/**
 * ContentCatalogContext — db-backed-content (Phase 2b-2 seam + overlay-full).
 *
 * Carries the full read catalog the client surfaces consume: by-piece
 * exercise pools, labyrinth pools, and the descriptions map. The default
 * value is the compiled baseline, so a consumer rendered WITHOUT a provider
 * behaves byte-identically to a direct baseline import — this is what keeps
 * the flag-off read path unchanged.
 *
 * The /exercises server boundary mounts `<ContentCatalogProvider>` with the
 * merged (baseline ⊕ stage-filtered overlay) catalog from `getMergedCatalog()`,
 * when this deployment has a `CONTENT_STAGE` floor. With it unset no provider is
 * mounted and every selector falls through to the baseline default.
 *
 * Note: unlike most context hooks here, the selectors do NOT throw when
 * consumed outside a provider — the baseline default is the intended
 * fallback, not a misuse.
 */

import { createContext, useContext, type ReactNode } from "react";
import { EXERCISES, LABYRINTHS, DIAGONAL_RUN } from "@/lib/game/exercises";
import { GENERATED_EXERCISE_DESCRIPTIONS } from "@/lib/game/generated/puzzles.generated";
import type { Exercise, PieceId } from "@/lib/game/types";

/** The full read catalog (same fields the merged loader exposes). */
export interface ContentCatalog {
  exercises: Record<PieceId, Exercise[]>;
  labyrinths: Record<PieceId, Exercise[]>;
  /** Pivot Challenge pool (kind:"pivot"). Separate runtime bucket; projected
   *  into the training path as labyrinth nodes by the exercises-screen adapter.
   *  Optional so partial fixtures/providers stay valid — readers fall back to
   *  the baseline `DIAGONAL_RUN` (same pattern as the no-provider baseline default). */
  diagonalRun?: Record<PieceId, Exercise[]>;
  descriptions: Record<string, string>;
}

const DEFAULT_CATALOG: ContentCatalog = {
  exercises: EXERCISES,
  labyrinths: LABYRINTHS,
  diagonalRun: DIAGONAL_RUN,
  descriptions: GENERATED_EXERCISE_DESCRIPTIONS,
};

const ContentCatalogContext = createContext<ContentCatalog>(DEFAULT_CATALOG);

export function ContentCatalogProvider({
  value,
  children,
}: {
  value: ContentCatalog;
  children: ReactNode;
}) {
  return (
    <ContentCatalogContext.Provider value={value}>
      {children}
    </ContentCatalogContext.Provider>
  );
}

/** Active by-piece exercise pools. Baseline `EXERCISES` with no provider.
 *  Return shape unchanged from the Phase 2b-2 seam (back-compat). */
export function useExerciseCatalog(): Record<PieceId, Exercise[]> {
  return useContext(ContentCatalogContext).exercises;
}

/** Active by-piece labyrinth pools. Baseline `LABYRINTHS` with no provider. */
export function useLabyrinthCatalog(): Record<PieceId, Exercise[]> {
  return useContext(ContentCatalogContext).labyrinths;
}

/** Active by-piece Pivot Challenge pools. Baseline `DIAGONAL_RUN` with no provider
 *  (or when a provider supplies a catalog without the optional `diagonalRun` field). */
export function useDiagonalRunCatalog(): Record<PieceId, Exercise[]> {
  return useContext(ContentCatalogContext).diagonalRun ?? DIAGONAL_RUN;
}

/** Active exercise descriptions map. Baseline generated map with no provider. */
export function useExerciseDescriptions(): Record<string, string> {
  return useContext(ContentCatalogContext).descriptions;
}

/**
 * Back-compat provider for the Phase 2c exercises-only mount. Wraps the full
 * `ContentCatalogProvider`, supplying the given exercise pools while leaving
 * labyrinths + descriptions at baseline. Kept so the read path stays green
 * across stages; the /exercises boundary moves to `ContentCatalogProvider`
 * with the full merged catalog in the overlay-full follow-up.
 */
export function ExerciseCatalogProvider({
  value,
  children,
}: {
  value: Record<PieceId, Exercise[]>;
  children: ReactNode;
}) {
  return (
    <ContentCatalogProvider value={{ ...DEFAULT_CATALOG, exercises: value }}>
      {children}
    </ContentCatalogProvider>
  );
}
