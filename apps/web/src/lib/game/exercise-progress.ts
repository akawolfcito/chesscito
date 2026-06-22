/**
 * Cross-piece exercise completion summary. Used by the Hub Hero CTA to
 * decide whether the player is "new" (zero exercises across every
 * piece) or "default" (has touched the practice flow at least once).
 *
 * The piece-progress storage shape — `chesscito:progress:{piece}` →
 * `{ stars: Record<exerciseId, number> }` (legacy entries may still hold
 * `{ stars: number[] }` until migrated on next load) — is also read by
 * `loadStarsPerPiece` in `hub-scaffold-client.tsx`. This helper
 * intentionally keeps a tiny surface so the Hero CTA derivation never has
 * to know storage keys, and tolerates both shapes.
 */

import type { PieceId } from "@/lib/game/types";
import { pieceProgressStorageKey } from "@/lib/lite-progress-storage";

const PIECES = ["rook", "bishop", "knight", "pawn", "queen", "king"] as const;

/**
 * Reads the id-keyed stars map for a single piece without the exercise pool.
 * Returns a sparse Record<exerciseId, stars> suitable for passing to
 * buildTrainingPath as `progress.stars`.
 *
 * Conservative fallback: legacy positional arrays return `{}` (exercises
 * will appear unplayed → Content Loop shows "continue-path"). The exercises
 * page migrates the legacy format on first load, after which this reads correctly.
 */
export function readPieceStars(piece: PieceId): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(pieceProgressStorageKey(piece));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { stars?: unknown };
    if (
      parsed.stars &&
      typeof parsed.stars === "object" &&
      !Array.isArray(parsed.stars)
    ) {
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(parsed.stars as Record<string, unknown>)) {
        if (typeof v === "number" && Number.isFinite(v) && v > 0 && v <= 3) {
          out[k] = v;
        }
      }
      return out;
    }
  } catch {
    // ignore corrupt entry
  }
  return {};
}

/** Returns the count of exercises with stars > 0 across every piece.
 *  Zero = brand-new player (Hero CTA flips to "START WITH PIECES"). */
export function getExercisesCompletedCount(): number {
  if (typeof window === "undefined") return 0;
  let total = 0;
  for (const piece of PIECES) {
    try {
      const raw = window.localStorage.getItem(pieceProgressStorageKey(piece));
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { stars?: unknown };
      // Tolerate both the legacy positional array and the id-keyed map:
      // iterate the values either way and count the positive entries.
      const values = Array.isArray(parsed.stars)
        ? parsed.stars
        : parsed.stars && typeof parsed.stars === "object"
          ? Object.values(parsed.stars)
          : [];
      for (const s of values) {
        if (typeof s === "number" && Number.isFinite(s) && s > 0) total += 1;
      }
    } catch {
      // ignore corrupt entries; treat as zero.
    }
  }
  return total;
}
