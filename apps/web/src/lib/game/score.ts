/**
 * Score arithmetic for the exercises path.
 *
 * `MAX_SUBMITTABLE_SCORE` is the bound `/api/sign-score` validates against.
 * It is **input validation, not an anti-cheat control** — be clear about this,
 * because an earlier version of this file claimed otherwise. Nothing ties the
 * `score` in the request body to real progress: progress lives in the player's
 * localStorage and the server never sees it. Anyone can POST a maximal score
 * for a piece they never played and it will be signed. The bound exists only to
 * keep absurd values out of `signTypedData`. Real cheat resistance would mean
 * deriving the score server-side from persisted progress — a feature, not a
 * number.
 *
 * So the ceiling is deliberately GENEROUS, and deliberately NOT derived from
 * the live catalog:
 *
 *  - A tight ceiling is what caused the incident this replaces. The route
 *    hardcoded 1500, described as "15 stars × 100 pts" — the ceiling of a
 *    5-exercise pool. The pools grew to 10 and the cap did not, so crossing
 *    15★ on any piece permanently broke that piece's on-chain save with a 400.
 *    The better the player, the more certainly locked out.
 *  - Deriving it from the merged catalog would put Supabase on the signing
 *    path and reintroduce the same 400 intermittently: the page resolves the
 *    catalog on render, the route would resolve it on save, and
 *    `getMergedCatalog` is cached with a 60s TTL and a 2s overlay timeout that
 *    falls back to baseline. Client and server can disagree.
 *
 * Instead the ceiling is a product invariant with a test that fails if any
 * baseline pool ever outgrows it. The number cannot go stale in silence, which
 * was the original defect. Exercises added through the content builder (which
 * appends to a pool live, with no redeploy) are covered up to the invariant.
 */

import { EXERCISES } from "@/lib/game/exercises";
import { getMaxPossibleStars } from "@/lib/game/progress-adapter";
import type { ExerciseCatalog } from "@/lib/game/rotation";
import type { PieceId } from "@/lib/game/types";

export const POINTS_PER_STAR = 100;
export const STARS_PER_EXERCISE = 3;

/** Product invariant: the most exercises we allow a single piece to hold.
 *  Roughly 3× today's pools — room to keep authoring without touching this.
 *  Guarded by `score.test.ts`: outgrow it and CI fails, so the bump is a
 *  decision rather than an outage. */
export const MAX_EXERCISES_PER_PIECE = 30;

/** The bound `/api/sign-score` validates `score` against. */
export const MAX_SUBMITTABLE_SCORE =
  MAX_EXERCISES_PER_PIECE * STARS_PER_EXERCISE * POINTS_PER_STAR;

/** Highest score a perfect run on `piece` can produce, for the given catalog.
 *  Display and analysis only — never a validation bound (see the note above). */
export function getMaxScoreForPiece(
  piece: PieceId,
  catalog: ExerciseCatalog = EXERCISES,
): number {
  return getMaxPossibleStars(piece, catalog) * POINTS_PER_STAR;
}
