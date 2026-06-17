/**
 * Rotation Engine — pure selector helpers (slice B, 2026-06-08).
 *
 * Consumes the 10/15 content pool to drive tier-gated daily rotation.
 * Everything here is PURE: no React, no localStorage, no network, no
 * Date.now()/Math.random(). Callers pass the UTC date string and the
 * wallet/session seed in; these functions only read the static catalog
 * and the progress map they are given, and never mutate either.
 *
 * Plan: docs/product/chesscito-rotation-engine-calibration-2026-06-08.md.
 * This slice wires NO UI and changes NO persistence — selectors only.
 */

import { EXERCISES } from "@/lib/game/exercises";
import type { Exercise, ExerciseTier, PieceId } from "@/lib/game/types";

/**
 * Per-exercise best stars keyed by exerciseId — the forward, order-
 * independent progress shape the rotation engine reads. Slice C builds
 * the legacy-array → id-map adapter; this slice just consumes the shape.
 */
export type ExerciseStarsById = Record<string, number>;

/** Tier unlock thresholds (mastery stars summed across the piece pool).
 *  Spec: Easy from day 1, Medium @ 5★, Hard @ 9★. */
export const MEDIUM_UNLOCK_STARS = 5;
export const HARD_UNLOCK_STARS = 9;

/** Curated first-touch exercises shown to guests (first N of the pool). */
export const CANONICAL_FIVE_COUNT = 5;

/** Max exercises surfaced per piece per day. */
export const DAILY_VISIBLE_LIMIT = 5;

/** A by-piece catalog the read path can inject. Defaults to the baseline
 *  `EXERCISES`; Phase 2c passes the merged (baseline ⊕ overlay) catalog. */
export type ExerciseCatalog = Record<PieceId, Exercise[]>;

/** Full pool for a piece. Returns a shallow copy so callers can never
 *  mutate the catalog array. */
export function getExercisePool(
  piece: PieceId,
  catalog: ExerciseCatalog = EXERCISES,
): Exercise[] {
  return [...catalog[piece]];
}

/** The canonical first-touch set: the first 5 exercises of the pool.
 *  (Caveat accepted: Knight/Pawn include one Medium among their first 5.) */
export function getCanonicalFive(
  piece: PieceId,
  catalog: ExerciseCatalog = EXERCISES,
): Exercise[] {
  return catalog[piece].slice(0, CANONICAL_FIVE_COUNT);
}

/** Mastery = sum of best stars across the whole pool (each ≤3). Mirrors
 *  the badge's across-pool calc; exported so slice F can reuse it without
 *  inventing a second implementation. Returns 0 when no progress. */
export function getPieceMasteryStars(
  piece: PieceId,
  progress?: ExerciseStarsById,
  catalog: ExerciseCatalog = EXERCISES,
): number {
  if (!progress) return 0;
  return catalog[piece].reduce((sum, ex) => {
    const raw = progress[ex.id] ?? 0;
    const clamped = raw < 0 ? 0 : raw > 3 ? 3 : raw;
    return sum + clamped;
  }, 0);
}

/** Tiers unlocked by a mastery-star count. Easy is always unlocked.
 *  Piece-agnostic: whether a piece actually HAS Hard content is decided
 *  downstream by the visible selector (it can only return tiers present
 *  in the pool). */
export function getUnlockedTiers(masteryStars: number): ExerciseTier[] {
  const tiers: ExerciseTier[] = ["easy"];
  if (masteryStars >= MEDIUM_UNLOCK_STARS) tiers.push("medium");
  if (masteryStars >= HARD_UNLOCK_STARS) tiers.push("hard");
  return tiers;
}

/** FNV-1a 32-bit string hash — deterministic, dependency-free. Uses
 *  Math.imul (allowed); never Math.random/Date. */
function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic per-(piece, seed, day) rotation key. `dateUtc` MUST be a
 *  UTC date string (e.g. "2026-06-08") so the day rolls over consistently
 *  with the Daily Tactic / Peones daily cap (UTC-day). */
export function buildRotationSeed(args: {
  piece: PieceId;
  walletOrSessionSeed: string;
  dateUtc: string;
}): string {
  return `${args.walletOrSessionSeed}:${args.dateUtc}:${args.piece}`;
}

/**
 * Up to 5 exercises to surface for a piece today.
 *
 * - Only exercises in UNLOCKED tiers (mastery-gated) are candidates;
 *   tiers absent from the pool (e.g. a piece with no Hard yet) are
 *   simply never returned even when the tier is unlocked.
 * - Bias: less-completed exercises come first (by stars ascending).
 * - Tie-break: a seeded per-exercise key derived from
 *   `wallet/session + UTC date + piece`, so the same seed/date/piece is
 *   stable and a new date reshuffles the selection.
 * - Never returns more than `limit` (default 5). Never mutates the
 *   catalog or the progress map.
 */
export function getVisibleExercisesForToday(opts: {
  piece: PieceId;
  walletOrSessionSeed: string;
  dateUtc: string;
  progress?: ExerciseStarsById;
  limit?: number;
  catalog?: ExerciseCatalog;
}): Exercise[] {
  const { piece, walletOrSessionSeed, dateUtc, progress } = opts;
  const limit = opts.limit ?? DAILY_VISIBLE_LIMIT;
  const catalog = opts.catalog ?? EXERCISES;

  const mastery = getPieceMasteryStars(piece, progress, catalog);
  const unlocked = new Set(getUnlockedTiers(mastery));
  const seed = buildRotationSeed({ piece, walletOrSessionSeed, dateUtc });

  return catalog[piece]
    .filter((ex) => unlocked.has(ex.tier ?? "easy"))
    .map((ex) => ({
      ex,
      stars: progress?.[ex.id] ?? 0,
      key: hashString(`${seed}:${ex.id}`),
    }))
    .sort((a, b) => (a.stars !== b.stars ? a.stars - b.stars : a.key - b.key))
    .slice(0, limit)
    .map((entry) => entry.ex);
}
