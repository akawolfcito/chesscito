/* ── Special Training lane projection ──────────────────────────────
 * The single answer to "which levels are in a piece's Special Training
 * lane right now?".
 *
 * A signature game REPLACES the piece's raw labyrinths in that lane (what
 * the bishop's Pivot Challenges did to bishop-lab-3/-4: still in content,
 * just unselected). This projection is the adapter that lets the whole
 * labyrinth nav/unlock/completion machinery serve the signature games
 * without adding a TrainingNodeKind.
 *
 * It lives here, pure, because it used to live INLINE in the exercises
 * screen while the hub built its paths straight off raw LABYRINTHS. The two
 * surfaces disagreed about what the lane even contained: the hub's Start
 * Focus pointed at `queen-lab-*` nodes the screen no longer shows. One
 * projection, two callers, no way to drift.
 * ----------------------------------------------------------------- */

import type { Exercise, PieceId } from "@/lib/game/types";

export type LaneCatalog = Record<PieceId, Exercise[]>;

/**
 * The signature-game pools, in the order they take precedence. Every field is
 * optional so partial fixtures and providers stay valid — an absent or empty
 * pool simply leaves that piece's raw labyrinths in place.
 */
export type SignaturePools = {
  /** Pivot Challenge (bishop). */
  diagonalRun?: LaneCatalog;
  /** Knight's Tour. Graded by coverage. */
  knightTour?: LaneCatalog;
  /** N-Queens. Graded by coverage. */
  queens?: LaneCatalog;
  /** Safe Path (king). Graded by MOVE COUNT, unlike its two neighbours. */
  safePath?: LaneCatalog;
  /** Promotion Run (pawn). Graded by FAILURES, unlike either neighbour. */
  promotionRun?: LaneCatalog;
};

/** Precedence order. A piece has at most one signature game, so this only
 *  ever resolves ties that cannot happen — but it fixes the answer if one
 *  ever does, instead of leaving it to object key order. */
const POOL_ORDER = [
  "diagonalRun",
  "knightTour",
  "queens",
  "safePath",
  "promotionRun",
] as const satisfies readonly (keyof SignaturePools)[];

/**
 * The lane as it actually ships: `labyrinths`, with each piece's raw levels
 * swapped for its signature game where one exists.
 *
 * Pieces without a signature game keep their labyrinths byte-identically —
 * which is what makes the rook (whose signature game IS its four curated
 * `rook-rail-*` labyrinths) pass through untouched.
 */
export function projectSpecialTrainingLane(
  labyrinths: LaneCatalog,
  pools: SignaturePools,
): LaneCatalog {
  const out = { ...labyrinths };
  for (const piece of Object.keys(out) as PieceId[]) {
    for (const key of POOL_ORDER) {
      const pool = pools[key]?.[piece];
      if (pool?.length) {
        out[piece] = pool;
        break;
      }
    }
  }
  return out;
}

/**
 * Lane ids for `piece` that grade by COVERAGE rather than by move count, so
 * the node picks `tourStars` over `labyrinthStars`. The Knight's Tour and
 * N-Queens both score this way — hence the neutral name.
 *
 * Unrouted, these games score 3 stars on every run, dead ends included:
 * their best is measured against a ceiling, so `best <= optimalMoves` always
 * holds, which is labyrinthStars' top band.
 */
export function coverageLaneIds(
  pools: SignaturePools,
  piece: PieceId,
): ReadonlySet<string> {
  return new Set([
    ...(pools.knightTour?.[piece] ?? []).map((level) => level.id),
    ...(pools.queens?.[piece] ?? []).map((level) => level.id),
  ]);
}

/** Lane ids whose completion is preserved but which never expose stars. */
export function starlessLaneIds(
  pools: SignaturePools,
  piece: PieceId,
): ReadonlySet<string> {
  return new Set((pools.knightTour?.[piece] ?? []).map((level) => level.id));
}
