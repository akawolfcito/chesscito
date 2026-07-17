/**
 * Contracts for the DB-backed content overlay (db-backed-content Phase 1).
 *
 * The compiled baseline (generated module) stays the source of truth for the
 * player read path. A `content_overlay` Supabase table holds only DELTAS:
 * new puzzles, edits to a baseline puzzle, and soft-deletes. Phase 1 ships the
 * write side only (this contract + the migration + the admin write route); the
 * read path still serves the baseline. See docs/specs/db-backed-content.md.
 */
import type { Exercise, ExerciseTier, PieceId } from "@/lib/game/types";

/** Which of the two content buckets a puzzle is stored in — a routing axis, NOT
 *  the puzzle's own `kind` (labyrinth vs queens vs safe-path vs …). The two are
 *  independent: a `kind:"queens"` puzzle lives in the `labyrinth` bucket. */
export type ContentBucket = "exercise" | "labyrinth";

/**
 * Content maturity ladder (content-staging-model). Lower rank = less mature
 * (closer to "being edited"). A puzzle can hold one version per stage, e.g. a
 * live `published` + an in-progress `draft` of the same id.
 */
export type ContentStage = "draft" | "preview" | "published";

/** Total order for the visibility ladder. */
export const STAGE_RANK: Record<ContentStage, number> = {
  draft: 0,
  preview: 1,
  published: 2,
};

/** The compiled baseline catalog shape (mirrors the generated module). Input to
 *  the overlay merge; also the fallback when the overlay is unavailable. */
export interface BaselineCatalog {
  exercises: Record<PieceId, Exercise[]>;
  labyrinths: Record<PieceId, Exercise[]>;
  /** Pivot Challenge pool (kind:"pivot"). Baseline-sourced this phase — the
   *  overlay does not manage pivot rows yet, so it passes straight through.
   *  Optional so partial fixtures stay valid; `getBaseline()` always sets it. */
  diagonalRun?: Record<PieceId, Exercise[]>;
  /** Knight's Tour pool (kind:"knight-tour"). Baseline-sourced, same as
   *  `diagonalRun`: the overlay does not manage tour rows yet. */
  knightTour?: Record<PieceId, Exercise[]>;
  /** N-Queens pool (kind:"queens"). Baseline-sourced, same as the two above. */
  queens?: Record<PieceId, Exercise[]>;
  descriptions: Record<string, string>;
}

/** The merged, ready-to-serve catalog (same shape the generated module exports,
 *  plus observability fields). Returned by getMergedCatalog(). */
export interface MergedCatalog extends BaselineCatalog {
  /** "baseline-only" when the overlay was unavailable/empty (fallback path). */
  source: "baseline+overlay" | "baseline-only";
  /** How many overlay rows were actually applied (post-validation). */
  overlayCount: number;
}

/**
 * One overlay row = one puzzle delta. Mirrors the builder/import record shape
 * (`LabyrinthRecord`) plus routing (`kind`) + audit fields. Persisted to the
 * `content_overlay` table, keyed by `(kind, id)`.
 */
export interface ContentOverlayRow {
  id: string;
  kind: ContentBucket;
  piece: PieceId;
  fen: string;
  target: string;
  mover: string | null;
  tier: ExerciseTier;
  tags: string[] | null;
  explanation: string | null;
  order: number;
  /** Soft-delete (already a builder concept). A disabled row removes its
   *  puzzle from the merged pool in Phase 2. */
  disabled: boolean;
  /** BFS-verified at write time; stored so the read path can trust it without
   *  re-running BFS per request. */
  optimal_moves: number;
  /** ISO timestamp; audit + cache-key hint. Server-assigned on upsert. */
  updated_at: string;
  /** Maturity of THIS version. Part of the PK `(kind, id, stage)`. */
  stage: ContentStage;
}

/**
 * Admin write request (builder → server). Reuses the dev-route record shape
 * plus `kind`. The server computes `optimal_moves` (BFS) and `updated_at`, so
 * the client never supplies them.
 */
export interface ContentWriteRequest {
  kind: ContentBucket;
  /** Save always lands at `draft`; the server assigns stage, so the client never
   *  supplies it (nor the BFS-derived / audit fields). */
  record: Omit<ContentOverlayRow, "optimal_moves" | "updated_at" | "stage">;
}

export type ContentWriteResult =
  | { ok: true; saved: ContentOverlayRow; revalidated: boolean }
  | { ok: false; errors: string[] };

/**
 * Promote (from < to) or demote (from > to) one puzzle version. Moves the
 * `from`-stage row to `to`, replacing + superseding anything at stage-rank ≤ `to`
 * for that id (content-staging-model Behavior 4). Runs as one transaction.
 */
export interface ContentStageRequest {
  kind: ContentBucket;
  id: string;
  /** Optional — omit to auto-detect the freshest existing version ("set to `to`"). */
  from?: ContentStage;
  to: ContentStage;
}

export type ContentStageResult =
  | { ok: true; from: ContentStage; to: ContentStage }
  | { ok: false; errors: string[] };
