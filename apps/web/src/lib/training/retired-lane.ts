/* ── Retired Special Training lanes ────────────────────────────────
 * Mastery is earned, never revoked by an internal id change.
 *
 * When each piece got its signature game, the game REPLACED the piece's
 * raw labyrinths in the Special Training lane (exercises-screen's lane
 * projection). The bests a player had already banked are keyed by the OLD
 * ids, so the mastery check — which walks the ACTIVE lane — stopped seeing
 * them and the crown fell back from `complete` to `available`.
 *
 * This module is the historical record of what each lane used to be, so
 * that check can also ask "did they finish the lane that was there when
 * they played it?".
 *
 * THREE constraints this module exists to honour (founder, 2026-07-29):
 *
 *  1. It answers for the MASTERY NODE ONLY. Retired levels are never shown,
 *     recommended, or navigated to again — they are gone from the lane and
 *     they stay gone. Nothing here feeds nav, unlock, stars or completion
 *     counts.
 *  2. It is ALL-OR-NOTHING. A partial retired lane is not mastery, and a
 *     mix of some-old + some-new ids is not mastery either. Only a lane
 *     that was finished in full, under one id scheme or the other, counts.
 *  3. It is FROZEN HISTORY, not a view of the catalog. Deriving it from
 *     LABYRINTHS would make it drift the moment the builder edits content —
 *     and the whole point is what shipped BACK THEN. It is a literal, and a
 *     test pins it per piece.
 *
 * Lifecycle: this map can be deleted once no player is still carrying
 * pre-signature-game bests. It is dead weight by design, not a foundation.
 * ----------------------------------------------------------------- */

import type { PieceId } from "@/lib/game/types";

/**
 * The labyrinth ids that each piece's Special Training lane held before its
 * signature game replaced them. Verified against GENERATED_LABYRINTHS at the
 * commit that introduced this file.
 *
 * The rook is deliberately empty: its signature game IS its four curated
 * `rook-rail-*` labyrinths, so nothing was ever retired for it and its
 * canonical lane check already covers every rook player.
 *
 * Note `pawn-lab-2` does not exist — the pawn's labs are 1, 3, 4, 5. Exercise
 * ids are not sequential; this list is transcribed, not generated.
 */
export const RETIRED_LANE_IDS: Record<PieceId, readonly string[]> = {
  rook: [],
  bishop: ["bishop-lab-3", "bishop-lab-4"],
  knight: [
    "knight-lab-1",
    "knight-lab-2",
    "knight-lab-3",
    "knight-lab-4",
    "knight-lab-5",
  ],
  pawn: ["pawn-lab-1", "pawn-lab-3", "pawn-lab-4", "pawn-lab-5"],
  queen: ["queen-lab-1", "queen-lab-2", "queen-lab-3"],
  king: ["king-lab-1"],
};

/**
 * True only when EVERY id of the piece's retired lane has a recorded best.
 *
 * A piece with no retired lane (the rook) returns false rather than
 * vacuously true: "no evidence" must never be an argument for a crown. The
 * caller ORs this with the canonical lane check, which is what handles the
 * rook and every player who came after the signature games shipped.
 *
 * `labyrinthBests` is the existing sparse best-moves map
 * (`chesscito:labyrinth-best:{piece}`); an absent or null entry means the
 * level was never completed.
 */
export function retiredLaneComplete(
  piece: PieceId,
  labyrinthBests: Record<string, number | null>,
): boolean {
  const retired = RETIRED_LANE_IDS[piece];
  if (retired.length === 0) return false;
  return retired.every((id) => (labyrinthBests[id] ?? null) !== null);
}
