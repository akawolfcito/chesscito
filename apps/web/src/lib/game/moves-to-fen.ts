import { Chess } from "chess.js";

/**
 * Reconstruct the FEN of a finished game by replaying its move list.
 *
 * The Coach `GameRecord` schema persists moves but not the final FEN
 * (the field was never added). Recomputing on read is cheap — chess.js
 * is already in the bundle for Arena, and a 200-move replay is sub-ms
 * on a modern phone. For repeated reads (history list re-renders) we
 * memoize behind a small LRU keyed on the move string.
 *
 * Returns `null` when the move list is empty (no game started yet) or
 * when chess.js rejects the input (corrupted record, schema drift). The
 * caller is expected to render an empty board / a placeholder in either
 * case rather than throw.
 */
const CACHE_MAX = 256;
const cache = new Map<string, string>();

function cacheGet(key: string): string | undefined {
  const hit = cache.get(key);
  if (hit === undefined) return undefined;
  // LRU bump — re-insert moves the entry to the most-recent end of the
  // Map's insertion order, which the eviction logic below relies on.
  cache.delete(key);
  cache.set(key, hit);
  return hit;
}

function cacheSet(key: string, value: string): void {
  if (cache.size >= CACHE_MAX) {
    // Drop the least-recently-used entry (first key in insertion order).
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) cache.delete(oldestKey);
  }
  cache.set(key, value);
}

export function movesToFen(moves: readonly string[]): string | null {
  if (moves.length === 0) return null;
  const key = moves.join(",");
  const hit = cacheGet(key);
  if (hit !== undefined) return hit;

  try {
    const game = new Chess();
    for (const move of moves) {
      // chess.js v0.13+ throws on illegal moves; v1.x returns null.
      // Either way, a failure means the GameRecord is corrupt — we
      // bail rather than render a half-played thumbnail.
      const applied = game.move(move);
      if (!applied) return null;
    }
    const fen = game.fen();
    cacheSet(key, fen);
    return fen;
  } catch {
    return null;
  }
}

/** Test-only — wipe the cache so individual test cases stay isolated. */
export function __resetMovesToFenCacheForTests(): void {
  cache.clear();
}
