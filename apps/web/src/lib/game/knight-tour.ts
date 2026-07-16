/**
 * Knight's Tour — pure mechanics + reachability. Spec: docs/specs/2026-07-16-signature-games-spec.md §1.
 *
 * One turn = one jump. The knight leaves an X on the square it vacates and may
 * never enter an X again, so the run is a self-avoiding walk that ends when no
 * legal unvisited square remains. Score = squares visited ÷ reachable.
 *
 * `reachableSquares` is the level's ceiling — walls included — which is why the
 * founder can resize a puzzle in the builder (a 5x5 pocket = 25 squares) with
 * zero code changes.
 *
 * ⚠️ The ceiling is an UPPER BOUND, not a promise: BFS asks "can the knight ever
 * touch this square", while a tour must reach it without revisiting. The longest
 * self-avoiding walk is a different (NP-hard) question, so a level can have a
 * reachable set the player provably cannot cover. That is why levels ship small
 * and walled, and why level feel is tuned in /dev/labyrinth-builder — the spec
 * fixes the score as visited ÷ reachable regardless.
 *
 * No React, no IO — the board owns the state, this owns the rules.
 */
import type { BoardPosition } from "@/lib/game/types";
import { getKnightMoves } from "@/lib/game/rules/knight";

const key = (p: BoardPosition) => `${p.file},${p.rank}`;
const keysOf = (ps: readonly BoardPosition[]) => new Set(ps.map(key));

/**
 * The knight's legal jumps from `pos`: on-board, not a wall, and not already
 * carrying an X. A knight can never jump onto its own square, so `pos` itself
 * being in `visited` costs nothing here.
 */
export function legalTourMoves(
  pos: BoardPosition,
  visited: readonly BoardPosition[],
  walls: readonly BoardPosition[],
): BoardPosition[] {
  const blocked = keysOf(walls);
  const marked = keysOf(visited);
  return getKnightMoves(pos).filter(
    (m) => !blocked.has(key(m)) && !marked.has(key(m)),
  );
}

/**
 * Every square the knight could ever stand on, walls included — the level's
 * ceiling, and the denominator of the score. Includes `start`. Walls are
 * ignored as jump-overs (a knight jumps): they only forbid landing.
 */
export function reachableSquares(
  start: BoardPosition,
  walls: readonly BoardPosition[],
): BoardPosition[] {
  const blocked = keysOf(walls);
  if (blocked.has(key(start))) return [];
  const seen = new Set<string>([key(start)]);
  const out: BoardPosition[] = [start];
  const queue: BoardPosition[] = [start];
  while (queue.length > 0) {
    const pos = queue.shift()!;
    for (const move of getKnightMoves(pos)) {
      const k = key(move);
      if (blocked.has(k) || seen.has(k)) continue;
      seen.add(k);
      out.push(move);
      queue.push(move);
    }
  }
  return out;
}

/** The run is over: every square the knight can still jump to carries an X. */
export function isTourStuck(
  pos: BoardPosition,
  visited: readonly BoardPosition[],
  walls: readonly BoardPosition[],
): boolean {
  return legalTourMoves(pos, visited, walls).length === 0;
}
