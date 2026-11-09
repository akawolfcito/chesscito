/**
 * N-Queens — pure mechanics + the exact ceiling. Spec: docs/specs/2026-07-16-signature-games-spec.md §2.
 *
 * One turn = one queen. Queens may never attack each other, so the run is a
 * shrinking board that ends when no safe square remains. Score = queens placed
 * ÷ ceiling, graded by the shared coverage grader (`tour-score.ts`).
 *
 * Blocks break rays (founder, 2026-07-16): a block between two queens lets them
 * share a file, rank or diagonal. That is what `getQueenMoves` already does with
 * its `blockers` argument, and it is what turns blocks from an obstacle into the
 * level designer's tool — a walled level can hold MORE queens, not fewer.
 *
 * ⚠️ Unlike the Knight's Tour, this ceiling is EXACT, not an upper bound. The
 * tour's ceiling is BFS-reachability, which a player may provably not be able to
 * cover (longest self-avoiding walk is NP-hard) — hence its levels ship filtered.
 * Here `maxQueens` backtracks the real placement, so the ceiling it returns is
 * achievable by construction and the 80% pass line is always playable.
 * See [[feedback_reachable_is_not_achievable]].
 *
 * No React, no IO — the board owns the state, this owns the rules.
 */
import type { BoardPosition } from "@/lib/game/types";
import { getQueenMoves } from "@/lib/game/rules/queen";

const BOARD_SIZE = 8;

const key = (p: BoardPosition) => `${p.file},${p.rank}`;
const keysOf = (ps: readonly BoardPosition[]) => new Set(ps.map(key));

/** Every square on the board, in a stable order the solver can index by. */
function allSquares(): BoardPosition[] {
  const out: BoardPosition[] = [];
  for (let file = 0; file < BOARD_SIZE; file += 1) {
    for (let rank = 0; rank < BOARD_SIZE; rank += 1) out.push({ file, rank });
  }
  return out;
}

/**
 * Every square under fire, deduped. Only the BLOCKS cut the rays — the queens
 * are not passed as blockers, and that is not a shortcut:
 *
 * `getQueenMoves` stops BEFORE a blocker (they model friendly pieces, so the
 * blocked square is not a legal move). Feed it the other queens and a queen
 * stops attacking the queen next to it — every position reads as legal. Feeding
 * blocks only keeps the one semantic we need: a queen's ray reaches any square
 * with no BLOCK in between, which is exactly "is that square under fire".
 *
 * Queens never shield each other here, and they provably never need to: if a
 * queen stood between another queen and its target, it would be standing on that
 * queen's ray — an illegal position, rejected before it ever reaches this board.
 */
export function attackedByQueens(
  queens: readonly BoardPosition[],
  blocks: readonly BoardPosition[],
): BoardPosition[] {
  const seen = new Set<string>();
  const out: BoardPosition[] = [];
  for (const queen of queens) {
    for (const move of getQueenMoves(queen, [...blocks])) {
      const k = key(move);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(move);
    }
  }
  return out;
}

/**
 * Where the next queen may legally go: on-board, empty, not a block, and out of
 * every queen's reach. Attack is symmetric under the same blockers, so a queen
 * placed here attacks nothing either — safe means safe in both directions.
 */
export function safeSquares(
  queens: readonly BoardPosition[],
  blocks: readonly BoardPosition[],
): BoardPosition[] {
  const taken = keysOf([...queens, ...blocks, ...attackedByQueens(queens, blocks)]);
  return allSquares().filter((sq) => !taken.has(key(sq)));
}

/** True when no queen stands on a square another queen attacks. */
function isLegalPosition(
  queens: readonly BoardPosition[],
  blocks: readonly BoardPosition[],
): boolean {
  const attacked = keysOf(attackedByQueens(queens, blocks));
  return !queens.some((q) => attacked.has(key(q)));
}

/**
 * The exact maximum number of queens that fit, counting `fixed` — the level's
 * ceiling and the denominator of the score. Returns 0 when `fixed` is already an
 * illegal position: that is not a level, it is a bug in the level.
 *
 * ⚠️ Derive N from this, never author it. A hand-written N above the real
 * maximum makes the level silently impossible — the trap the tour walked into.
 *
 * The search is sound because attack depends only on the blocks, never on the
 * other queens: placing one can only shrink the safe set, and every subset of a
 * legal position stays legal. So each configuration has exactly one path in
 * index order, and exploring forward from `from` misses none of them.
 */
export function maxQueens(
  fixed: readonly BoardPosition[],
  blocks: readonly BoardPosition[],
): number {
  if (!isLegalPosition(fixed, blocks)) return 0;

  const squares = allSquares();
  const indexOf = new Map(squares.map((sq, i) => [key(sq), i]));
  let best = fixed.length;

  const search = (queens: BoardPosition[], from: number) => {
    const candidates = safeSquares(queens, blocks).filter(
      (sq) => (indexOf.get(key(sq)) ?? -1) >= from,
    );
    if (queens.length + candidates.length <= best) return; // can't beat `best`
    for (const sq of candidates) {
      queens.push(sq);
      best = Math.max(best, queens.length);
      search(queens, (indexOf.get(key(sq)) ?? 0) + 1);
      queens.pop();
    }
  };

  search([...fixed], 0);
  return best;
}

/** The run is over: there is nowhere left to legally place a queen. */
export function isQueensStuck(
  queens: readonly BoardPosition[],
  blocks: readonly BoardPosition[],
): boolean {
  return safeSquares(queens, blocks).length === 0;
}
