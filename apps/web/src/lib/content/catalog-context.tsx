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
import { EXERCISES, LABYRINTHS, DIAGONAL_RUN, KNIGHT_TOUR, QUEENS, SAFE_PATH, PROMOTION_RUN } from "@/lib/game/exercises";
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
  /** Knight's Tour pool (kind:"knight-tour"). Same bucket/adapter pattern as
   *  `diagonalRun`; graded by coverage, never by move count. */
  knightTour?: Record<PieceId, Exercise[]>;
  /** N-Queens pool (kind:"queens"). Same bucket/adapter pattern; graded by
   *  coverage, never by move count. */
  queens?: Record<PieceId, Exercise[]>;
  /** Safe Path pool (kind:"safe-path"). Same bucket/adapter pattern, but the
   *  OPPOSITE grader to its two neighbours above: arrival, by MOVE COUNT —
   *  lower is better. Graded with labyrinthStars, never tourStars. */
  safePath?: Record<PieceId, Exercise[]>;
  /** Promotion Run pool (kind:"promotion-run"). Same bucket/adapter pattern,
   *  but graded by NEITHER of its neighbours: not coverage, and not moves.
   *  Every winning run is the same length, so it grades FAILURES
   *  (`promotionRunStars`). See the note there before wiring it to anything. */
  promotionRun?: Record<PieceId, Exercise[]>;
  descriptions: Record<string, string>;
}

const DEFAULT_CATALOG: ContentCatalog = {
  exercises: EXERCISES,
  labyrinths: LABYRINTHS,
  diagonalRun: DIAGONAL_RUN,
  knightTour: KNIGHT_TOUR,
  queens: QUEENS,
  safePath: SAFE_PATH,
  promotionRun: PROMOTION_RUN,
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

/** Active by-piece Knight's Tour pools. Baseline `KNIGHT_TOUR` with no provider
 *  (or when a provider supplies a catalog without the optional field). */
export function useKnightTourCatalog(): Record<PieceId, Exercise[]> {
  return useContext(ContentCatalogContext).knightTour ?? KNIGHT_TOUR;
}

/** Active by-piece N-Queens pools. Baseline `QUEENS` with no provider
 *  (or when a provider supplies a catalog without the optional field). */
export function useQueensCatalog(): Record<PieceId, Exercise[]> {
  return useContext(ContentCatalogContext).queens ?? QUEENS;
}

/** Active by-piece Safe Path pools. Baseline `SAFE_PATH` with no provider
 *  (or when a provider supplies a catalog without the optional field). */
export function useSafePathCatalog(): Record<PieceId, Exercise[]> {
  return useContext(ContentCatalogContext).safePath ?? SAFE_PATH;
}

/** Active by-piece Promotion Run pools. Baseline `PROMOTION_RUN` with no
 *  provider (or when a provider supplies a catalog without the optional
 *  field). */
export function usePromotionRunCatalog(): Record<PieceId, Exercise[]> {
  return useContext(ContentCatalogContext).promotionRun ?? PROMOTION_RUN;
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
