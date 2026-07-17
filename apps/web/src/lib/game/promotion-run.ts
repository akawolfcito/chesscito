/**
 * Promotion Run — the pawn's signature game. Pure rules + exact solver, no React.
 *
 * The pawn is the only piece that MOVES and EATS differently, and that is the
 * whole game: it cannot change file without capturing. A blocked file is not an
 * obstacle to walk around — there is no around. The enemies on the diagonals are
 * not in the way; they are the STEPS.
 *
 * Founder's sketch, which the tests hold to: c2 -> c3 -> xb4 -> b5 -> xc6, each
 * file change paid for with a capture.
 *
 * ⚠️ The attack map here is LIVE, unlike Safe Path's (P1/P2). Landing on a
 * watched square loses — same rule as the king (D4) — but the pawn captures, and
 * a captured enemy stops watching. So the map is recomputed per position.
 *
 * That is affordable ONLY because a pawn never retreats (§3.4). Every move,
 * push or capture, advances the rank by exactly one, so the state graph is a DAG
 * at most 6 plies deep and 3 wide: the entire tree is ~3^6 paths. The solver
 * below enumerates ALL of them and is exact by brute force — no memoisation, no
 * ceiling to approximate, no cleverness to get wrong.
 *
 * The king cannot have this. His cheapness came from enemies being untouchable
 * (D1) precisely because he WANDERS: capture + wander is a cyclic search over
 * (position x surviving enemies). Do not carry this back.
 *
 * Spec: docs/specs/2026-07-16-safe-path-promotion-run-plan.md §3.3-§3.4, stage 7.
 */
import type { BoardPosition, PieceId } from "@/lib/game/types";
import { attackedSquares } from "@/lib/game/attack-map";
import { posToSquare, type TypedEnemy } from "@/lib/game/fen-puzzle";

/** White pawn: up the board. The last rank is where it promotes. */
const PROMOTION_RANK = 7;

const inBoard = (f: number, r: number) => f >= 0 && f < 8 && r >= 0 && r < 8;
const samePos = (a: BoardPosition, b: BoardPosition) =>
  a.file === b.file && a.rank === b.rank;

/** Everything that moves during a run. The walls never do, so they are passed
 *  alongside rather than carried in here. */
export type PawnRunState = {
  pawn: BoardPosition;
  /** The enemies still ALIVE. A capture returns a state with one fewer. */
  enemies: readonly TypedEnemy[];
};

/**
 * A single legal move. `captures` names the victim so the caller can drop it
 * from the live map — a capture the caller has to re-derive is a capture the
 * caller will eventually re-derive wrong.
 */
export type PawnMove = {
  to: BoardPosition;
  captures: BoardPosition | null;
};

/** What the level asks the player to crown. A typed contract rather than a
 *  hardcoded queen: the mission IS the mechanic (P3), and the bishop-pair
 *  variant (§3.5) should slot in as a widened type, not as surgery. */
export type MissionSpec = {
  promoteTo: PieceId;
};

/**
 * Where the pawn may legally go from here.
 *
 * Push: straight, one square, ONLY if empty — walls and enemies both block, and
 * neither can be captured forward.
 * Capture: one square diagonally, ONLY onto an enemy. Never onto an empty
 * square, and never onto a wall: a wall is scenery, not a piece.
 */
export function legalPawnMoves(
  state: PawnRunState,
  walls: readonly BoardPosition[],
): PawnMove[] {
  const { pawn, enemies } = state;
  const enemyAt = (f: number, r: number) =>
    enemies.find((e) => e.pos.file === f && e.pos.rank === r) ?? null;
  const wallAt = (f: number, r: number) =>
    walls.some((w) => w.file === f && w.rank === r);

  const out: PawnMove[] = [];
  const rank = pawn.rank + 1;
  if (rank > PROMOTION_RANK) return out; // already crowned; nothing follows

  // Push — free square only. A pawn does not capture forward.
  if (
    inBoard(pawn.file, rank) &&
    !enemyAt(pawn.file, rank) &&
    !wallAt(pawn.file, rank)
  ) {
    out.push({ to: { file: pawn.file, rank }, captures: null });
  }

  // Capture — a victim only. This is the pawn's ONLY way to change file.
  for (const df of [-1, 1]) {
    const file = pawn.file + df;
    if (!inBoard(file, rank)) continue;
    const victim = enemyAt(file, rank);
    if (!victim) continue; // empty diagonal is not a move
    out.push({ to: { file, rank }, captures: victim.pos });
  }

  return out;
}

/** Whether the pawn standing here is seen by a surviving enemy (P1). Walls block
 *  rays, exactly as they do for the king. */
export function isPawnCaught(
  state: PawnRunState,
  walls: readonly BoardPosition[],
): boolean {
  return attackedSquares(state.enemies, walls).has(posToSquare(state.pawn));
}

/**
 * The shortest run that reaches the last rank alive, as the squares the pawn
 * lands on. `null` when no such run exists — an unwinnable level, which the
 * content lint must reject rather than ship.
 *
 * Exhaustive: every path is walked (§3.4 — there are ~3^6 of them). Depth-first
 * with a shortest-so-far cut, because the answer is a route the player must be
 * able to take, and an approximation is a level that lies.
 *
 * ⚠️ `mission` does NOT filter routes. The walk to the last rank is the same
 * whatever you crown; `promoteTo` is checked at the promotion, by the board. A
 * solver that filtered by it would be answering a question nobody asked.
 */
export function promotionRunSolve(
  start: BoardPosition,
  enemies: readonly TypedEnemy[],
  walls: readonly BoardPosition[],
  mission: MissionSpec,
): BoardPosition[] | null {
  void mission; // see the docblock: the route does not depend on it.

  let best: BoardPosition[] | null = null;

  const walk = (state: PawnRunState, path: BoardPosition[]) => {
    if (best !== null && path.length >= best.length) return; // no shorter run lies this way

    for (const move of legalPawnMoves(state, walls)) {
      const survivors = move.captures
        ? state.enemies.filter((e) => !samePos(e.pos, move.captures!))
        : state.enemies;
      const next: PawnRunState = { pawn: move.to, enemies: survivors };

      // The live map: `survivors`, not `state.enemies`. The piece he just took
      // is not watching him from the square he took it on.
      if (isPawnCaught(next, walls)) continue;

      const nextPath = [...path, move.to];
      if (move.to.rank === PROMOTION_RANK) {
        if (best === null || nextPath.length < best.length) best = nextPath;
        continue; // the run ends at the crown; nothing follows it
      }
      walk(next, nextPath);
    }
  };

  const from: PawnRunState = { pawn: start, enemies };
  // A level that starts the pawn in check is an authoring error, not a puzzle.
  if (isPawnCaught(from, walls)) return null;
  walk(from, []);

  return best;
}
