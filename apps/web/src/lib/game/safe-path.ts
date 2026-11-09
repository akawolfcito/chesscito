/**
 * Safe Path — the king's signature game. Pure rules + BFS, no React.
 *
 * Founder's framing, which is the contract:
 *
 *   "el rey es el personaje que quieres sacar del peligro, la meta es un
 *    refugio, las piezas enemigas no se mueven, pero vigilan zonas del tablero
 *    […] un laberinto de peligro, no necesariamente de muros. No sería 'no
 *    puedes pasar porque hay una pared' sino 'puedes pasar físicamente por ahí,
 *    pero es una zona vigilada, así que no debes hacerlo'."
 *
 * So LEGAL and SAFE are two questions, and this module refuses to merge them:
 *
 *   legalKingSteps → where the king CAN step. Walls and enemies block.
 *   isCaught       → whether standing there kills him. Watched = caught (D4):
 *                    the step is legal, and it loses. That is the danger maze.
 *
 * Collapsing them into "legal moves are the safe ones" would rebuild a maze of
 * walls and delete the lesson — the king's rule is not "you cannot", it is
 * "you must not".
 *
 * Enemies are static and untouchable (D1), so the attack map is a per-level
 * constant. That is what lets BFS run over a fixed grid instead of searching
 * (king position × surviving enemies).
 *
 * Spec: docs/specs/2026-07-16-safe-path-promotion-run-plan.md §3, §4 stage 3.
 */
import type { BoardPosition } from "@/lib/game/types";
import { attackedSquares } from "@/lib/game/attack-map";
import { posToSquare, type TypedEnemy } from "@/lib/game/fen-puzzle";

const KING_DELTAS = [
  { file: 0, rank: 1 },
  { file: 0, rank: -1 },
  { file: 1, rank: 0 },
  { file: -1, rank: 0 },
  { file: 1, rank: 1 },
  { file: 1, rank: -1 },
  { file: -1, rank: 1 },
  { file: -1, rank: -1 },
];

const inBoard = (f: number, r: number) => f >= 0 && f < 8 && r >= 0 && r < 8;

/**
 * The squares the king may physically step onto: the 8 neighbours, minus the
 * board edge, minus walls, minus enemies.
 *
 * Enemies block because the king never captures (D1). Watched squares are NOT
 * removed — walking into one is legal, and it is how you lose.
 */
export function legalKingSteps(
  from: BoardPosition,
  enemies: readonly TypedEnemy[],
  walls: readonly BoardPosition[],
): BoardPosition[] {
  const blocked = new Set([
    ...enemies.map((e) => posToSquare(e.pos)),
    ...walls.map(posToSquare),
  ]);

  return KING_DELTAS.map((d) => ({
    file: from.file + d.file,
    rank: from.rank + d.rank,
  }))
    .filter((p) => inBoard(p.file, p.rank))
    .filter((p) => !blocked.has(posToSquare(p)));
}

/** Whether the king standing on `pos` is seen — and therefore caught (D4). */
export function isCaught(
  pos: BoardPosition,
  enemies: readonly TypedEnemy[],
  walls: readonly BoardPosition[] = [],
): boolean {
  return attackedSquares(enemies, walls).has(posToSquare(pos));
}

/**
 * Shortest SAFE route from `start` to `refuge`, in king moves.
 *
 * Returns `null` when no safe route exists — an unwinnable level, which the
 * content lint must reject rather than ship. Note the asymmetry with
 * `isCaught`: BFS only ever enqueues squares that are both legal and unwatched,
 * so a route this returns can never end in death.
 *
 * ⚠️ This is a move count: LOWER IS BETTER. It feeds `labyrinthStars`, never a
 * coverage percentage — two `number`s of opposite meaning would swap silently.
 */
export function safePathOptimalMoves(
  start: BoardPosition,
  refuge: BoardPosition,
  enemies: readonly TypedEnemy[],
  walls: readonly BoardPosition[],
): number | null {
  const refugeSquare = posToSquare(refuge);
  if (posToSquare(start) === refugeSquare) return 0;

  // Computed ONCE: enemies are static, so the danger never moves (D1).
  const watched = attackedSquares(enemies, walls);
  if (watched.has(refugeSquare)) return null; // the refuge is a trap

  const seen = new Set<string>([posToSquare(start)]);
  let frontier: BoardPosition[] = [start];
  let distance = 0;

  while (frontier.length > 0) {
    distance += 1;
    const next: BoardPosition[] = [];

    for (const pos of frontier) {
      for (const step of legalKingSteps(pos, enemies, walls)) {
        const square = posToSquare(step);
        if (seen.has(square)) continue;
        if (watched.has(square)) continue; // legal, but it loses — never route here
        if (square === refugeSquare) return distance;
        seen.add(square);
        next.push(step);
      }
    }

    frontier = next;
  }

  return null;
}
