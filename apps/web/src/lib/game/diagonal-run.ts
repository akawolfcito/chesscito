/**
 * Diagonal Run — pure pivot mechanics + BFS (Gate D2, corrected model).
 *
 * One turn = one tap. The player taps a PIVOT square (any square the bishop can
 * reach along a clear diagonal — a normal bishop move). The bishop:
 *   1. slides to the pivot and pauses there;
 *   2. TURNS onto a perpendicular diagonal (it never continues straight through
 *      the pivot) and slides until it reaches the star (capture → win), stops one
 *      square before a blocker, or reaches the board edge.
 * If a perpendicular from the pivot points straight at the star, the bishop
 * captures it. Otherwise the game auto-picks the exit with a soft heuristic
 * (the landing closest to the star) — zero-effort, deterministic, and BFS-safe.
 *
 * State = bishop position; action = tap a pivot; transition = the deterministic
 * pivot resolution. Not a generic engine — just what Diagonal Run needs.
 */
import type { BoardPosition } from "@/lib/game/types";
import { getBishopMoves } from "@/lib/game/rules/bishop";

const sign = (n: number) => Math.sign(n);
const inBoard = (f: number, r: number) => f >= 0 && f < 8 && r >= 0 && r < 8;
const samePos = (a: BoardPosition, b: BoardPosition) =>
  a.file === b.file && a.rank === b.rank;
const chebyshev = (a: BoardPosition, b: BoardPosition) =>
  Math.max(Math.abs(a.file - b.file), Math.abs(a.rank - b.rank));

/** Every clear-diagonal square the bishop can reach — its legal pivots. */
export function reachablePivots(
  pos: BoardPosition,
  blockers: BoardPosition[],
): BoardPosition[] {
  return getBishopMoves(pos, blockers);
}

/**
 * Slide the bishop from `pos` in the direction implied by `chosen`, stopping at
 * the star (if met first), one square before a blocker, or the board edge.
 * Returns null when there is no room in that direction. Used for the exit slide.
 */
export function getBishopGlideDestination(
  pos: BoardPosition,
  chosen: BoardPosition,
  blockers: BoardPosition[],
  target: BoardPosition,
): BoardPosition | null {
  const df = chosen.file - pos.file;
  const dr = chosen.rank - pos.rank;
  if (df === 0 || Math.abs(df) !== Math.abs(dr)) return null;
  const sf = sign(df);
  const sr = sign(dr);
  const isBlocker = (f: number, r: number) =>
    blockers.some((b) => b.file === f && b.rank === r);
  let f = pos.file + sf;
  let r = pos.rank + sr;
  if (!inBoard(f, r) || isBlocker(f, r)) return null;
  let last: BoardPosition | null = null;
  while (inBoard(f, r) && !isBlocker(f, r)) {
    last = { file: f, rank: r };
    if (f === target.file && r === target.rank) break;
    f += sf;
    r += sr;
  }
  return last;
}

export type Vec = { file: number; rank: number };

export type PivotResolution =
  | { outcome: "illegal" }
  /** Tapping the star's square directly, or a pivot whose turn reaches it. */
  | { outcome: "win"; pivot: BoardPosition; exitDir: Vec | null; landing: BoardPosition }
  /** A legal pivot that does not reach the star; the bishop ends at `landing`. */
  | { outcome: "move"; pivot: BoardPosition; exitDir: Vec; landing: BoardPosition };

/**
 * Resolve a tap on `pivot` from `from`. The pivot must be a reachable bishop
 * move. The exit is one of the two diagonals PERPENDICULAR to the approach line
 * (never straight through). A perpendicular that reaches the star wins; otherwise
 * the soft heuristic picks the exit whose landing is closest to the star.
 */
export function resolvePivot(
  from: BoardPosition,
  pivot: BoardPosition,
  blockers: BoardPosition[],
  target: BoardPosition,
): PivotResolution {
  if (samePos(from, pivot)) return { outcome: "illegal" };
  if (!reachablePivots(from, blockers).some((m) => samePos(m, pivot))) {
    return { outcome: "illegal" };
  }
  // Tapping the star itself (reachable on a clear diagonal) captures it.
  if (samePos(pivot, target)) {
    return { outcome: "win", pivot, exitDir: null, landing: target };
  }

  const approach: Vec = {
    file: sign(pivot.file - from.file),
    rank: sign(pivot.rank - from.rank),
  };
  // The two diagonals perpendicular to the approach line.
  const perps: Vec[] = [
    { file: approach.file, rank: -approach.rank },
    { file: -approach.file, rank: approach.rank },
  ];

  const exits = perps
    .map((d) => ({
      d,
      landing: getBishopGlideDestination(
        pivot,
        { file: pivot.file + d.file, rank: pivot.rank + d.rank },
        blockers,
        target,
      ),
    }))
    .filter((e): e is { d: Vec; landing: BoardPosition } => e.landing !== null);

  const winning = exits.find((e) => samePos(e.landing, target));
  if (winning) {
    return { outcome: "win", pivot, exitDir: winning.d, landing: target };
  }
  if (exits.length === 0) {
    // Degenerate pivot with no perpendicular room — stays put.
    return { outcome: "move", pivot, exitDir: { file: 0, rank: 0 }, landing: pivot };
  }
  // Soft heuristic: the exit whose landing sits closest to the star.
  exits.sort((a, b) => chebyshev(a.landing, target) - chebyshev(b.landing, target));
  return { outcome: "move", pivot, exitDir: exits[0].d, landing: exits[0].landing };
}

export type PivotBfsResult = { reachable: boolean; optimalMoves: number };

/**
 * Fewest taps to capture the star. Transitions are deterministic (the heuristic
 * fixes each exit), so BFS is well-defined and also answers "is the star still
 * reachable from here?" for the lost-path check.
 */
export function pivotBfs(
  start: BoardPosition,
  target: BoardPosition,
  blockers: BoardPosition[],
): PivotBfsResult {
  if (samePos(start, target)) return { reachable: true, optimalMoves: 0 };
  const key = (p: BoardPosition) => `${p.file},${p.rank}`;
  const seen = new Set<string>([key(start)]);
  const queue: Array<{ pos: BoardPosition; depth: number }> = [
    { pos: start, depth: 0 },
  ];
  while (queue.length > 0) {
    const node = queue.shift()!;
    for (const pivot of reachablePivots(node.pos, blockers)) {
      const r = resolvePivot(node.pos, pivot, blockers, target);
      if (r.outcome === "illegal") continue;
      if (r.outcome === "win") {
        return { reachable: true, optimalMoves: node.depth + 1 };
      }
      if (!seen.has(key(r.landing))) {
        seen.add(key(r.landing));
        queue.push({ pos: r.landing, depth: node.depth + 1 });
      }
    }
  }
  return { reachable: false, optimalMoves: Infinity };
}
