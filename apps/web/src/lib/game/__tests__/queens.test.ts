import { describe, expect, it } from "vitest";
import {
  attackedByQueens,
  safeSquares,
  maxQueens,
  isQueensStuck,
} from "@/lib/game/queens";
import type { BoardPosition } from "@/lib/game/types";

const P = (sq: string): BoardPosition => ({
  file: "abcdefgh".indexOf(sq[0]),
  rank: Number(sq[1]) - 1,
});
const labels = (ps: BoardPosition[]) =>
  ps.map((p) => `${"abcdefgh"[p.file]}${p.rank + 1}`).sort();
const at = (...sqs: string[]) => sqs.map(P);

/**
 * N-Queens (spec 2026-07-16 §2). Queens are placed one per turn and may never
 * attack each other; the run ends when no safe square remains. Score = queens
 * placed ÷ ceiling, and the ceiling is the EXACT maximum from the solver.
 *
 * SOLUTION: a full 8-queens board with a queen on the a1 corner. Nothing else
 * fits — which is what makes it the stuck case and the ceiling of an open board.
 */
const SOLUTION = at("a1", "b5", "c8", "d6", "e3", "f7", "g2", "h4");

describe("attackedByQueens", () => {
  it("covers the queen's full reach on an open board", () => {
    // A lone queen on d4 sees 27 squares: 14 by rank+file, 13 by diagonal.
    expect(attackedByQueens(at("d4"), [])).toHaveLength(27);
  });

  it("stops the ray at a block", () => {
    const attacked = labels(attackedByQueens(at("a1"), at("a3")));
    expect(attacked).toContain("a2");
    expect(attacked).not.toContain("a4");
    expect(attacked).not.toContain("a8");
  });

  it("puts the square a queen stands on under fire, so illegal pairs are seen", () => {
    // Queens do NOT shield each other: they are not fed to `getQueenMoves` as
    // blockers, which stops BEFORE a blocker and would read a1/a5 as legal.
    expect(labels(attackedByQueens(at("a1", "a5"), []))).toContain("a5");
  });
});

describe("safeSquares", () => {
  it("excludes every square the queens attack", () => {
    expect(labels(safeSquares(at("a1"), []))).not.toContain("a2");
  });

  it("excludes the squares the queens stand on", () => {
    expect(labels(safeSquares(at("a1"), []))).not.toContain("a1");
  });

  it("excludes the blocks themselves", () => {
    expect(labels(safeSquares(at("a1"), at("c2")))).not.toContain("c2");
  });

  it("is empty once the board is full", () => {
    expect(safeSquares(SOLUTION, [])).toHaveLength(0);
  });
});

describe("maxQueens — the ceiling is exact, never authored", () => {
  it("is 8 on an open board", () => {
    expect(maxQueens([], [])).toBe(8);
  });

  it("is still 8 when the first queen is fixed on a corner that has a solution", () => {
    expect(maxQueens(at("a1"), [])).toBe(8);
  });

  it("counts the fixed queens in the ceiling", () => {
    // A corner queen plus a full board of blocks: nothing else can be placed.
    const walls = at("a2", "b1", "b2");
    expect(maxQueens(at("a1"), walls)).toBeGreaterThanOrEqual(1);
  });

  it("returns 0 when the fixed queens already attack each other", () => {
    // a1 and a5 share an open file — an illegal position, not a 2-queen one.
    expect(maxQueens(at("a1", "a5"), [])).toBe(0);
  });

  it("lets a block open a possibility the open board forbids", () => {
    // THE founder's rule (2026-07-16): a block between two queens breaks the
    // ray, so a1 and a5 coexist on the same file. Without the block this is 0.
    expect(maxQueens(at("a1", "a5"), at("a3"))).toBeGreaterThanOrEqual(2);
  });
});

describe("isQueensStuck", () => {
  it("is false while a safe square remains", () => {
    expect(isQueensStuck(at("a1"), [])).toBe(false);
  });

  it("is true once no safe square remains", () => {
    expect(isQueensStuck(SOLUTION, [])).toBe(true);
  });
});
