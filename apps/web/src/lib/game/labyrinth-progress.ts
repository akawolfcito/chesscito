import type { PieceId } from "@/lib/game/types";

/**
 * Labyrinth best-score persistence — stores the minimum move count
 * achieved per labyrinth in localStorage. Cheap, off-chain, and
 * survives across sessions so a player can chase their own record.
 *
 * Storage shape (one key per piece):
 *   "chesscito:labyrinth-best:rook" → { "rook-lab-1": 4, "rook-lab-2": 6 }
 */

const STORAGE_PREFIX = "chesscito:labyrinth-best";

function storageKey(piece: PieceId): string {
  return `${STORAGE_PREFIX}:${piece}`;
}

function readMap(piece: PieceId): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(storageKey(piece));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, number>;
    }
  } catch {
    // Corrupt entry — treat as empty so we don't lock the player out.
  }
  return {};
}

/** Best (minimum) move count recorded for the given labyrinth, or
 *  null if the player hasn't completed it yet. */
export function getLabyrinthBest(piece: PieceId, labyrinthId: string): number | null {
  const map = readMap(piece);
  const value = map[labyrinthId];
  return typeof value === "number" && value > 0 ? value : null;
}

/** Records a completion. Returns true when the new score replaced
 *  the previous best (or this was the first completion). */
export function recordLabyrinthBest(
  piece: PieceId,
  labyrinthId: string,
  moves: number,
): boolean {
  if (typeof window === "undefined") return false;
  if (moves <= 0) return false;
  const map = readMap(piece);
  const prev = map[labyrinthId];
  const isImprovement = typeof prev !== "number" || moves < prev;
  if (!isImprovement) return false;
  try {
    const next = { ...map, [labyrinthId]: moves };
    localStorage.setItem(storageKey(piece), JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}
