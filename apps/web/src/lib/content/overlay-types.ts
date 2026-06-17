/**
 * Contracts for the DB-backed content overlay (db-backed-content Phase 1).
 *
 * The compiled baseline (generated module) stays the source of truth for the
 * player read path. A `content_overlay` Supabase table holds only DELTAS:
 * new puzzles, edits to a baseline puzzle, and soft-deletes. Phase 1 ships the
 * write side only (this contract + the migration + the admin write route); the
 * read path still serves the baseline. See docs/specs/db-backed-content.md.
 */
import type { ExerciseTier, PieceId } from "@/lib/game/types";

export type ContentKind = "exercise" | "labyrinth";

/**
 * One overlay row = one puzzle delta. Mirrors the builder/import record shape
 * (`LabyrinthRecord`) plus routing (`kind`) + audit fields. Persisted to the
 * `content_overlay` table, keyed by `(kind, id)`.
 */
export interface ContentOverlayRow {
  id: string;
  kind: ContentKind;
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
}

/**
 * Admin write request (builder → server). Reuses the dev-route record shape
 * plus `kind`. The server computes `optimal_moves` (BFS) and `updated_at`, so
 * the client never supplies them.
 */
export interface ContentWriteRequest {
  kind: ContentKind;
  record: Omit<ContentOverlayRow, "optimal_moves" | "updated_at">;
}

export type ContentWriteResult =
  | { ok: true; saved: ContentOverlayRow; revalidated: boolean }
  | { ok: false; errors: string[] };
