import type { Exercise, PieceId } from "@/lib/game/types";
import {
  GENERATED_EXERCISES,
  GENERATED_EXERCISE_DESCRIPTIONS,
  GENERATED_LABYRINTHS,
} from "@/lib/game/generated/puzzles.generated";

/** Pieces with exercises defined and playable */
export const PLAYABLE_PIECES: PieceId[] = ["rook", "bishop", "knight", "pawn", "queen", "king"];

/* The exercise catalog is fully content-sourced: the builder edits
 * content/exercises.json, `pnpm import-puzzles` regenerates
 * GENERATED_EXERCISES (FEN-decoded + BFS-verified optimalMoves), and
 * EXERCISES below sources straight from it. ids and relative order are
 * preserved through the FEN round-trip (order = original catalog index),
 * so id-keyed progress stays intact. (The 60 hand-authored exercises were
 * migrated out of TS literals 2026-06-16 via scripts/migrate-exercises.ts.)
 */
export const EXERCISES: Record<PieceId, Exercise[]> = {
  rook:   GENERATED_EXERCISES.rook,
  bishop: GENERATED_EXERCISES.bishop,
  knight: GENERATED_EXERCISES.knight,
  pawn:   GENERATED_EXERCISES.pawn,
  queen:  GENERATED_EXERCISES.queen,
  king:   GENERATED_EXERCISES.king,
};

export const BADGE_THRESHOLD = 10; // stars; pools vary (5-10 exercises → 15-30★ max per piece)

/**
 * Returns the current pool count for a piece. Per-piece dynamic
 * replacement for the legacy `EXERCISES_PER_PIECE` constant — needed
 * when piece pools diverge from the original 5 (e.g., King senda 5→10
 * planned for Sprint 2-3 of Training Economy Alpha 2026-06-05).
 *
 * Today every piece returns 5 so this is behavior-identical to the
 * deprecated constant. Callsites migrate to `getExerciseCount(piece)`
 * before any pool grows; once all consumers migrate, the deprecated
 * export below is removed.
 */
export function getExerciseCount(piece: PieceId): number {
  return EXERCISES[piece].length;
}

/**
 * @deprecated Use {@link getExerciseCount} for per-piece dynamic count.
 *
 * Kept during Sprint 1 (2026-06-05) for callsites not yet migrated —
 * result-overlay.tsx still imports it for its module-level `MAX_STARS`
 * and the `StarsRow` component. Migration deferred to Sprint 3 when
 * StarsRow takes a `piece` prop. Until then this constant returns 5
 * to keep visual parity with current piece pools.
 */
export const EXERCISES_PER_PIECE = 5;

/* ── L2 Labyrinths (POC) ──────────────────────────────────────────
 * Obstacles are friendly blocker pieces. The player's piece cannot
 * move through them or capture them. The labyrinth forces a non-
 * trivial path between startPos and targetPos. Stars are awarded by
 * how close the player's move count approaches `optimalMoves`:
 *   moves == optimal           → 3 stars
 *   moves <= optimal + 2       → 2 stars
 *   moves <= optimal + 4       → 1 star
 *   else                       → 0 stars (allowed, no fail)
 *
 * The labyrinth catalog is fully content-sourced: the builder edits
 * content/labyrinths.json, `pnpm import-puzzles` regenerates
 * GENERATED_LABYRINTHS (FEN-decoded + BFS-verified optimalMoves), and
 * LABYRINTHS below sources straight from it. ids and relative order are
 * preserved through the FEN round-trip. (The 18 hand-authored labs were
 * migrated out of TS literals 2026-06-16 via
 * scripts/migrate-labyrinths.ts.)
 * --------------------------------------------------------------- */

export const LABYRINTHS: Record<PieceId, Exercise[]> = {
  rook:   GENERATED_LABYRINTHS.rook,
  bishop: GENERATED_LABYRINTHS.bishop,
  knight: GENERATED_LABYRINTHS.knight,
  pawn:   GENERATED_LABYRINTHS.pawn,
  queen:  GENERATED_LABYRINTHS.queen,
  king:   GENERATED_LABYRINTHS.king,
};

/**
 * Resolve the human-readable description for an exercise row. Generated
 * ids carry their own description map (disjoint from the hand-authored
 * i18n keys), so prefer it; else fall back to the i18n lookup; else the
 * generic "Exercise N" fallback. Pure — `i18n`/`fallback` are injected so
 * this is unit-testable without a translator context.
 */
export function resolveExerciseDescription(
  id: string,
  index: number,
  i18n: (id: string) => string,
  fallback: (n: number) => string,
): string {
  const gen = GENERATED_EXERCISE_DESCRIPTIONS[id];
  if (gen) return gen;
  try {
    return i18n(id);
  } catch {
    return fallback(index + 1);
  }
}

/** Compute stars earned in a labyrinth. */
export function labyrinthStars(moves: number, optimal: number): number {
  if (moves <= optimal) return 3;
  if (moves <= optimal + 2) return 2;
  if (moves <= optimal + 4) return 1;
  return 0;
}
