import { describe, expect, it } from "vitest";
import { buildCatalog, type LabyrinthRecord } from "@/lib/content/catalog";

/**
 * Knight's Tour rows share content/labyrinths.json with the labyrinths and the
 * Diagonal Run, routed by `kind` into their own runtime bucket (spec §1).
 *
 * The tour has NO target square: it ends when the knight runs out of unvisited
 * squares. So the catalog cannot BFS-verify a path to a destination the way it
 * does for every other kind — it verifies the REACHABLE SET instead, and stores
 * its ceiling in optimalMoves.
 *
 * POCKET: walls on c2/c1/d2/d4/a5/c5 pin a knight on a1 to {a1, b3}. Rank by
 * rank (8 first): a5+c5 / d4 / b3 STAYS FREE — it is the pocket's other half /
 * c2+d2 / a1 mover + c1.
 */
const POCKET_FEN = "8/8/8/N1N5/3N4/8/2NN4/N1N5 w - - 0 1";

const tourRecord = (over: Partial<LabyrinthRecord> = {}): LabyrinthRecord => ({
  id: "knight-tour-test",
  piece: "knight",
  kind: "knight-tour",
  fen: "8/8/8/8/8/8/8/N7 w - - 0 1",
  mover: "a1",
  order: 0,
  ...over,
});

describe("buildCatalog — knight-tour routing", () => {
  it("routes the row to the knightTour bucket, never to labyrinths", () => {
    const cat = buildCatalog([], [tourRecord()], []);
    expect(cat.errors).toEqual([]);
    expect(cat.knightTour.knight).toHaveLength(1);
    expect(cat.labyrinths.knight).toHaveLength(0);
    expect(cat.diagonalRun.knight).toHaveLength(0);
  });

  it("accepts a row with no target — a tour has nowhere to arrive", () => {
    const cat = buildCatalog([], [tourRecord({ target: undefined })], []);
    expect(cat.errors).toEqual([]);
  });

  it("round-trips additive access metadata without inventing a default", () => {
    const premium = buildCatalog(
      [],
      [tourRecord({ access: "training_pass" })],
      [],
    );
    const legacy = buildCatalog([], [tourRecord()], []);
    expect(premium.knightTour.knight[0].access).toBe("training_pass");
    expect(legacy.knightTour.knight[0].access).toBeUndefined();
  });

  it("stores the reachable ceiling as optimalMoves: covering N squares is N-1 moves", () => {
    // Open board from a1: the knight reaches all 64 squares → 63 moves.
    const cat = buildCatalog([], [tourRecord()], []);
    expect(cat.knightTour.knight[0].optimalMoves).toBe(63);
  });

  it("measures the ceiling through the walls, not around them", () => {
    // Two walls (c5, d4) that do not box the knight in: the knight still reaches
    // every other square, so the ceiling drops to 62 squares → 61 moves. This is
    // what lets the founder resize a level in the builder with no code change.
    const cat = buildCatalog(
      [],
      [tourRecord({ fen: "8/8/8/2N5/3N4/8/8/N7 w - - 0 1" })],
      [],
    );
    expect(cat.errors).toEqual([]);
    expect(cat.knightTour.knight[0].optimalMoves).toBe(61);
  });

  it("rejects a level that walls the knight into a pocket too small to play", () => {
    // The sealed pocket reaches 2 squares. One wall too many is cheap to author
    // by accident and invisible until a player opens the level, so it fails at
    // import — loudly, naming the square the knight is stuck on.
    const cat = buildCatalog([], [tourRecord({ fen: POCKET_FEN })], []);
    expect(cat.knightTour.knight).toHaveLength(0);
    expect(cat.errors[0]).toContain("reaches only 2 square(s) from a1");
  });
});
