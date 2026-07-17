import { describe, expect, it } from "vitest";
import {
  buildCatalog,
  renderGeneratedModule,
  type LabyrinthRecord,
} from "@/lib/content/catalog";

/**
 * N-Queens rows share content/labyrinths.json with the labyrinths, the Diagonal
 * Run and the Knight's Tour, routed by `kind` into their own bucket (spec §2).
 *
 * Like the tour, a queens level has NO target square — it ends when no safe
 * square remains. So the catalog cannot BFS-verify a path to a destination; it
 * solves the level instead and stores the ceiling in optimalMoves.
 *
 * Unlike the tour, that ceiling is EXACT: `maxQueens` backtracks the real
 * placement, so what the catalog stores is achievable by construction.
 *
 * SEALED: knights fill every square off the a-file, so the only free squares are
 * a2..a8 — and the queen on a1 attacks the whole open file. Nowhere to place a
 * second queen: a ceiling of 1.
 */
const SEALED_FEN =
  "1NNNNNNN/1NNNNNNN/1NNNNNNN/1NNNNNNN/1NNNNNNN/1NNNNNNN/1NNNNNNN/QNNNNNNN w - - 0 1";

const queensRecord = (over: Partial<LabyrinthRecord> = {}): LabyrinthRecord => ({
  id: "queens-test",
  piece: "queen",
  kind: "queens",
  fen: "8/8/8/8/8/8/8/Q7 w - - 0 1",
  mover: "a1",
  order: 0,
  ...over,
});

describe("buildCatalog — queens routing", () => {
  it("routes the row to the queens bucket, never to labyrinths", () => {
    const cat = buildCatalog([], [queensRecord()], []);
    expect(cat.errors).toEqual([]);
    expect(cat.queens.queen).toHaveLength(1);
    expect(cat.labyrinths.queen).toHaveLength(0);
    expect(cat.diagonalRun.queen).toHaveLength(0);
    expect(cat.knightTour.queen).toHaveLength(0);
  });

  it("accepts a row with no target — a queens level has nowhere to arrive", () => {
    const cat = buildCatalog([], [queensRecord({ target: undefined })], []);
    expect(cat.errors).toEqual([]);
  });

  it("stores the ceiling minus the queen the level starts with", () => {
    // Open board, queen fixed on a1: the exact maximum is the classic 8. The
    // level ships the first one, so the player places the other 7.
    const cat = buildCatalog([], [queensRecord()], []);
    expect(cat.queens.queen[0].optimalMoves).toBe(7);
  });

  it("does not spend a queen on a block, because blocks break rays", () => {
    // The founder's rule (2026-07-16) seen from the catalog: a block on a3 costs
    // the board a square, yet the ceiling holds at 8+ — a1/b5/c8/d6/e3/f7/g2/h4
    // never needed a3, and the broken ray only ever opens more.
    const cat = buildCatalog(
      [],
      [queensRecord({ fen: "8/8/8/8/8/N7/8/Q7 w - - 0 1" })],
      [],
    );
    expect(cat.errors).toEqual([]);
    expect(cat.queens.queen[0].optimalMoves).toBeGreaterThanOrEqual(7);
  });

  it("rejects a level with nowhere to put a second queen", () => {
    // A ceiling of 1 is not a game, it is a queen alone on a sealed board. Cheap
    // to author by accident (one block too many) and invisible until a player
    // opens it, so it fails at import — naming the ceiling it measured.
    const cat = buildCatalog([], [queensRecord({ fen: SEALED_FEN })], []);
    expect(cat.queens.queen).toHaveLength(0);
    expect(cat.errors[0]).toContain("ceiling of 1");
  });
});

describe("renderGeneratedModule — queens", () => {
  it("emits the bucket, so the levels can reach the runtime", () => {
    // A bucket the generator does not emit is a bucket the game never sees:
    // import-puzzles would build the levels and drop them on the floor.
    const cat = buildCatalog([], [queensRecord()], []);
    const rendered = renderGeneratedModule(cat);
    expect(rendered).toContain("export const GENERATED_QUEENS");
    expect(rendered).toContain("queens-test");
  });
});
