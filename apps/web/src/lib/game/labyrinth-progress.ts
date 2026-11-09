import type { PieceId } from "@/lib/game/types";
import { labyrinthBestStorageKey } from "@/lib/lite-progress-storage";

/**
 * Labyrinth best-score persistence — stores the minimum move count
 * achieved per labyrinth in localStorage. Cheap, off-chain, and
 * survives across sessions so a player can chase their own record.
 *
 * Storage shape (one key per piece):
 *   "chesscito:labyrinth-best:rook" → { "rook-lab-1": 4, "rook-lab-2": 6 }
 */

function storageKey(piece: PieceId): string {
  return labyrinthBestStorageKey(piece);
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

/**
 * Full best-scores map for a piece, safe to pass directly to buildTrainingPath()
 * as `labyrinthBests`. Absent keys map to null inside buildTrainingPath via `?? null`.
 * Returns {} on SSR or missing data (all labyrinths stay "locked" — correct default).
 */
export function getLabyrinthBestsMap(piece: PieceId): Record<string, number> {
  return readMap(piece);
}

/** Best (minimum) move count recorded for the given labyrinth, or
 *  null if the player hasn't completed it yet. */
export function getLabyrinthBest(piece: PieceId, labyrinthId: string): number | null {
  const map = readMap(piece);
  const value = map[labyrinthId];
  return typeof value === "number" && value > 0 ? value : null;
}

/** True when every labyrinth id passed in has at least one recorded
 *  completion for the given piece. Returns false on an empty list so
 *  callers never accidentally trigger "all solved" flows without a
 *  catalog. Used by exercises-screen to decide whether to swap the
 *  labyrinth-solved primary CTA for "Enter Arena". */
export function areAllLabyrinthsSolved(
  piece: PieceId,
  labyrinthIds: readonly string[],
): boolean {
  if (labyrinthIds.length === 0) return false;
  const map = readMap(piece);
  return labyrinthIds.every((id) => {
    const value = map[id];
    return typeof value === "number" && value > 0;
  });
}

/**
 * Records a Knight's Tour run. Shares this map (bests are keyed by level id,
 * and a tour id never collides with a labyrinth id) but inverts the improvement
 * test: a tour's best is the MOST squares covered, a labyrinth's is the FEWEST
 * moves. Passing a tour to `recordLabyrinthBest` silently files the player's
 * worst run as their record — the value is the same shape, only the direction
 * differs, so nothing would ever throw.
 *
 * Readers must grade the returned best with `tourStars`, never `labyrinthStars`.
 */
export function recordTourBest(
  piece: PieceId,
  tourId: string,
  visited: number,
): boolean {
  if (typeof window === "undefined") return false;
  if (visited <= 0) return false;
  const map = readMap(piece);
  const prev = map[tourId];
  const isImprovement = typeof prev !== "number" || visited > prev;
  if (!isImprovement) return false;
  try {
    localStorage.setItem(storageKey(piece), JSON.stringify({ ...map, [tourId]: visited }));
    return true;
  } catch {
    return false;
  }
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
