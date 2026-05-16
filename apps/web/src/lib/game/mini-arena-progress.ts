/**
 * Mini-Arena best-score persistence — stores the minimum move count
 * achieved per setup in localStorage. Cheap, off-chain, survives
 * across sessions so a player can chase their own record.
 *
 * Storage shape:
 *   "chesscito:mini-arena-best" → { "kr-vs-k": 12 }
 */

const STORAGE_KEY = "chesscito:mini-arena-best";

function readMap(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, number>;
    }
  } catch {
    // Corrupt entry — treat as empty.
  }
  return {};
}

/** Best (minimum) move count recorded for the given setup, or
 *  null if the player hasn't completed it yet. */
export function getMiniArenaBest(setupId: string): number | null {
  const map = readMap();
  const value = map[setupId];
  return typeof value === "number" && value > 0 ? value : null;
}

/** Records a completion. Returns true when the new score replaced
 *  the previous best (or this was the first completion). */
export function recordMiniArenaBest(
  setupId: string,
  moves: number,
): boolean {
  if (typeof window === "undefined") return false;
  if (moves <= 0) return false;
  const map = readMap();
  const prev = map[setupId];
  const isImprovement = typeof prev !== "number" || moves < prev;
  if (!isImprovement) return false;
  try {
    const next = { ...map, [setupId]: moves };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}
