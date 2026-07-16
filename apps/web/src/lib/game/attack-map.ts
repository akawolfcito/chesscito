/**
 * Attack map — which squares static black enemies WATCH.
 *
 * This is deliberately NOT built on lib/game/rules/*. Those answer "where may
 * this piece move"; this answers "which squares are watched". The questions
 * differ by exactly one square per ray — the blocker's own square — and that
 * square is the whole point: it is where the king dies.
 *
 * Every rules module fails here, each differently:
 *   - rook/bishop/queen: `break` BEFORE `push`, so the blocker's square is
 *     excluded. Correct for movement (it is a friendly piece), fatal for threat.
 *   - king: filters blockers out of the result, same hole.
 *   - pawn: a MOVEMENT function — includes the forward push (which does not
 *     attack), yields diagonals only when `isCapture`, and hardcodes
 *     white-moves-up. Enemies are black and attack downward, always, occupied
 *     or not.
 *
 * ⚠️ The king is NOT passed in as a blocker. When computing which squares are
 * watched FOR THE PURPOSE OF KING MOVEMENT, the king must not block the ray
 * aimed at him — otherwise the square directly behind him reads "safe" and the
 * game teaches the exact opposite of the king's rule. Enemies block; the king
 * never does.
 *
 * Enemies are static and untouchable (plan D1), so this is a per-level
 * CONSTANT: compute once at load, never on a move.
 *
 * Spec: docs/specs/2026-07-16-safe-path-promotion-run-plan.md §1.3, §1.4, D1.
 */
import type { BoardPosition } from "@/lib/game/types";
import { posToSquare, type TypedEnemy } from "@/lib/game/fen-puzzle";

const inBoard = (f: number, r: number) => f >= 0 && f < 8 && r >= 0 && r < 8;

type Delta = { file: number; rank: number };

const ROOK_RAYS: Delta[] = [
  { file: 1, rank: 0 },
  { file: -1, rank: 0 },
  { file: 0, rank: 1 },
  { file: 0, rank: -1 },
];

const BISHOP_RAYS: Delta[] = [
  { file: 1, rank: 1 },
  { file: 1, rank: -1 },
  { file: -1, rank: 1 },
  { file: -1, rank: -1 },
];

const KNIGHT_JUMPS: Delta[] = [
  { file: 1, rank: 2 },
  { file: 2, rank: 1 },
  { file: 2, rank: -1 },
  { file: 1, rank: -2 },
  { file: -1, rank: -2 },
  { file: -2, rank: -1 },
  { file: -2, rank: 1 },
  { file: -1, rank: 2 },
];

const KING_STEPS: Delta[] = [...ROOK_RAYS, ...BISHOP_RAYS];

/** Black pawns move DOWN the board, so they watch the two squares diagonally
 *  below them. Never the one in front: a pawn does not capture forward. */
const BLACK_PAWN_ATTACKS: Delta[] = [
  { file: -1, rank: -1 },
  { file: 1, rank: -1 },
];

/** Walk a ray until it leaves the board or meets an occupied square. The
 *  occupied square IS watched — it is added, then the ray stops. */
function castRay(
  from: BoardPosition,
  delta: Delta,
  occupied: ReadonlySet<string>,
  out: Set<string>,
): void {
  let file = from.file + delta.file;
  let rank = from.rank + delta.rank;

  while (inBoard(file, rank)) {
    const square = posToSquare({ file, rank });
    out.add(square);
    if (occupied.has(square)) return; // watched, but the ray dies here
    file += delta.file;
    rank += delta.rank;
  }
}

function addSteps(
  from: BoardPosition,
  deltas: readonly Delta[],
  out: Set<string>,
): void {
  for (const delta of deltas) {
    const file = from.file + delta.file;
    const rank = from.rank + delta.rank;
    if (inBoard(file, rank)) out.add(posToSquare({ file, rank }));
  }
}

/**
 * Every square watched by at least one enemy.
 *
 * Enemies block each other's rays but are themselves watched — an enemy's
 * square is never a refuge. Returns squares in `posToSquare` form ("d5") so
 * membership is a Set lookup instead of an O(n) position scan.
 */
export function attackedSquares(enemies: readonly TypedEnemy[]): Set<string> {
  const occupied = new Set(enemies.map((e) => posToSquare(e.pos)));
  const watched = new Set<string>();

  for (const { pos, piece } of enemies) {
    switch (piece) {
      case "rook":
        for (const ray of ROOK_RAYS) castRay(pos, ray, occupied, watched);
        break;
      case "bishop":
        for (const ray of BISHOP_RAYS) castRay(pos, ray, occupied, watched);
        break;
      case "queen":
        for (const ray of [...ROOK_RAYS, ...BISHOP_RAYS]) {
          castRay(pos, ray, occupied, watched);
        }
        break;
      case "knight":
        addSteps(pos, KNIGHT_JUMPS, watched);
        break;
      case "king":
        addSteps(pos, KING_STEPS, watched);
        break;
      case "pawn":
        addSteps(pos, BLACK_PAWN_ATTACKS, watched);
        break;
    }
  }

  return watched;
}
