import type { PieceId } from "@/lib/game/types";

const PIECES: PieceId[] = ["rook", "bishop", "knight", "pawn", "queen", "king"];

function storageKey(piece: PieceId) {
  return `chesscito:progress:${piece}`;
}

/** Returns true when the player has recorded at least one earned star on
 *  any piece path. SSR-safe (always false on server). Read-only — does
 *  not touch storage schemas. */
export function hasAnyPieceProgress(): boolean {
  if (typeof window === "undefined") return false;
  for (const piece of PIECES) {
    try {
      const raw = localStorage.getItem(storageKey(piece));
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { stars?: unknown };
      if (Array.isArray(parsed.stars) && parsed.stars.some((s) => typeof s === "number" && s > 0)) {
        return true;
      }
    } catch {
      // corrupt entry — ignore
    }
  }
  return false;
}
