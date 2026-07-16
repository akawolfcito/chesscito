import type { Exercise, PieceId } from "@/lib/game/types";
import {
  GENERATED_EXERCISES,
  GENERATED_EXERCISE_DESCRIPTIONS,
  GENERATED_LABYRINTHS,
  GENERATED_DIAGONAL_RUN,
  GENERATED_KNIGHT_TOUR,
  GENERATED_QUEENS,
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
 * Returns the current pool count for a piece. Pools are per-piece and
 * dynamic: the baseline ships 10 exercises each, and the Supabase overlay
 * appends more up to `MAX_EXERCISES_PER_PIECE`.
 *
 * Never hardcode a pool size. The deprecated `EXERCISES_PER_PIECE = 5`
 * constant that used to live here outlived the 5-exercise pools and made
 * the Badge Earned modal and its share card advertise "12/15" against a
 * real 30★ ceiling (2026-07-09). Read the catalog, or take
 * `getMaxPossibleStars(piece, catalog)` for the star ceiling.
 */
export function getExerciseCount(piece: PieceId): number {
  return EXERCISES[piece].length;
}

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

/* ── Diagonal Run (Special Training, kind:"diagonal-run") ────────────────
 * A separate runtime bucket sourced from content/labyrinths.json rows tagged
 * `kind:"pivot"`. Each level is a turn-based pivot game (see diagonal-run.ts). Projected into the training
 * target); the connector squares are DERIVED at runtime via * never stored. During the piece-stabilisation phase these are PROJECTED into
 * `buildTrainingPath` as `labyrinth` nodes (adapter in the exercises screen) so
 * the whole navigation/unlock/completion machinery is reused without adding a
 * `TrainingNodeKind`. Promote to a first-class node only if several pieces need
 * distinct Special-Training semantics. Design: docs/audits/2026-07-15-bishop-b4_1-*. */
export const DIAGONAL_RUN: Record<PieceId, Exercise[]> = {
  rook:   GENERATED_DIAGONAL_RUN.rook,
  bishop: GENERATED_DIAGONAL_RUN.bishop,
  knight: GENERATED_DIAGONAL_RUN.knight,
  pawn:   GENERATED_DIAGONAL_RUN.pawn,
  queen:  GENERATED_DIAGONAL_RUN.queen,
  king:   GENERATED_DIAGONAL_RUN.king,
};

/* ── Knight's Tour (Special Training, kind:"knight-tour") ────────────────
 * Same adapter story as DIAGONAL_RUN: its own runtime bucket, sourced from
 * content/labyrinths.json, projected into `buildTrainingPath` as `labyrinth`
 * nodes so the nav/unlock/completion machinery is reused.
 *
 * ⚠️ The grader does NOT come along for the ride. A tour's stored best is
 * coverage and its `optimalMoves` is the reachable ceiling, so it must be graded
 * with `tourStars` (see lib/game/tour-score.ts) and written with
 * `recordTourBest`. `labyrinthStars` cannot read it: every run lands in its
 * 3-star band. Spec: docs/specs/2026-07-16-signature-games-spec.md §1. */
export const KNIGHT_TOUR: Record<PieceId, Exercise[]> = {
  rook:   GENERATED_KNIGHT_TOUR.rook,
  bishop: GENERATED_KNIGHT_TOUR.bishop,
  knight: GENERATED_KNIGHT_TOUR.knight,
  pawn:   GENERATED_KNIGHT_TOUR.pawn,
  queen:  GENERATED_KNIGHT_TOUR.queen,
  king:   GENERATED_KNIGHT_TOUR.king,
};

/* ── N-Queens (Special Training, kind:"queens") ──────────────────────────
 * The queen's signature game. Same adapter story as KNIGHT_TOUR, and the same
 * grader: coverage, never move count. `optimalMoves` holds the queens the
 * PLAYER places (ceiling - 1), so the denominator is `optimalMoves + 1` — the
 * arithmetic `buildTrainingPath` already runs for the tour.
 * Spec: docs/specs/2026-07-16-signature-games-spec.md §2. */
export const QUEENS: Record<PieceId, Exercise[]> = {
  rook:   GENERATED_QUEENS.rook,
  bishop: GENERATED_QUEENS.bishop,
  knight: GENERATED_QUEENS.knight,
  pawn:   GENERATED_QUEENS.pawn,
  queen:  GENERATED_QUEENS.queen,
  king:   GENERATED_QUEENS.king,
};

/**
 * Resolve the human-readable description for an exercise row. Generated
 * ids carry their own description map (disjoint from the hand-authored
 * i18n keys), so prefer it; else use the i18n lookup; else the generic
 * "Exercise N" fallback. Pure — `i18n`/`fallback` are injected so this is
 * unit-testable without a translator context.
 *
 * `descriptions` defaults to the compiled baseline map but is injectable so
 * the overlay read path can pass the merged (baseline ⊕ overlay) descriptions
 * — an overlay-edited `explanation` then overrides the baseline text. With the
 * default it is byte-identical to the pre-overlay resolver.
 *
 * `i18n` returns `null` (or an empty string) when the id has no
 * translation. The caller is expected to guard the translator (e.g.
 * `descriptions.has(id)`) and pass `null` for unknown ids, so a builder-
 * authored exercise with neither a generated description nor an editorial
 * key resolves to the generic fallback WITHOUT emitting a missing-message
 * console warning.
 */
export function resolveExerciseDescription(
  id: string,
  index: number,
  i18n: (id: string) => string | null,
  fallback: (n: number) => string,
  descriptions: Record<string, string> = GENERATED_EXERCISE_DESCRIPTIONS,
): string {
  const gen = descriptions[id];
  if (gen) return gen;
  const translated = i18n(id);
  if (translated) return translated;
  return fallback(index + 1);
}

/** Compute stars earned in a labyrinth. */
export function labyrinthStars(moves: number, optimal: number): number {
  if (moves <= optimal) return 3;
  if (moves <= optimal + 2) return 2;
  if (moves <= optimal + 4) return 1;
  return 0;
}
