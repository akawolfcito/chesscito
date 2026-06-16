import type { PieceId } from "@/lib/game/types";

const PIECES: PieceId[] = ["rook", "bishop", "knight", "pawn", "queen", "king"];

function storageKey(piece: PieceId) {
  return `chesscito:progress:${piece}`;
}

/** True when any persisted `stars` value is a positive number, across
 *  both the legacy positional array and the id-keyed map shape. */
function hasPositiveStar(stars: unknown): boolean {
  if (Array.isArray(stars)) {
    return stars.some((s) => typeof s === "number" && s > 0);
  }
  if (stars && typeof stars === "object") {
    return Object.values(stars).some((s) => typeof s === "number" && s > 0);
  }
  return false;
}

/** Returns true when the player has recorded at least one earned star on
 *  any piece path. SSR-safe (always false on server). Read-only — does
 *  not touch storage schemas. Tolerates both the legacy positional
 *  `stars: number[]` and the id-keyed `stars: Record<id, number>` shape. */
export function hasAnyPieceProgress(): boolean {
  if (typeof window === "undefined") return false;
  for (const piece of PIECES) {
    try {
      const raw = localStorage.getItem(storageKey(piece));
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { stars?: unknown };
      if (hasPositiveStar(parsed.stars)) {
        return true;
      }
    } catch {
      // corrupt entry — ignore
    }
  }
  return false;
}
