import { describe, expect, it } from "vitest";

import { LABYRINTHS } from "@/lib/game/exercises";
import { GENERATED_LABYRINTHS } from "@/lib/game/generated/puzzles.generated";
import type { PieceId } from "@/lib/game/types";

const PIECES: PieceId[] = [
  "rook",
  "bishop",
  "knight",
  "pawn",
  "queen",
  "king",
];

describe("LABYRINTHS catalog — invariants", () => {
  it("defines an array (possibly empty) for every piece", () => {
    for (const piece of PIECES) {
      expect(Array.isArray(LABYRINTHS[piece])).toBe(true);
    }
  });

  it("every labyrinth has the required shape", () => {
    for (const piece of PIECES) {
      for (const lab of LABYRINTHS[piece]) {
        expect(typeof lab.id).toBe("string");
        expect(lab.id.length).toBeGreaterThan(0);
        expect(typeof lab.startPos.file).toBe("number");
        expect(typeof lab.startPos.rank).toBe("number");
        expect(typeof lab.targetPos.file).toBe("number");
        expect(typeof lab.targetPos.rank).toBe("number");
        expect(typeof lab.optimalMoves).toBe("number");
        expect(lab.optimalMoves).toBeGreaterThan(0);
        // L2 labyrinths must declare at least one obstacle — that's
        // what distinguishes them from L1 exercises in the renderer
        // gate (`obstacles?: BoardPosition[]`).
        expect(Array.isArray(lab.obstacles)).toBe(true);
        expect(lab.obstacles!.length).toBeGreaterThan(0);
      }
    }
  });

  it("all labyrinth IDs are unique across the whole catalog", () => {
    const seen = new Set<string>();
    for (const piece of PIECES) {
      for (const lab of LABYRINTHS[piece]) {
        expect(seen.has(lab.id)).toBe(false);
        seen.add(lab.id);
      }
    }
  });
});

// Regression guards pin the HAND-AUTHORED floor per piece; generated
// puzzles are appended (augment, never replace), so the merged total is
// `hand-authored + GENERATED_LABYRINTHS[piece].length`.
describe("LABYRINTHS catalog — per-piece counts (regression guards)", () => {
  it("Rook keeps its 3 hand-authored labyrinths", () => {
    expect(LABYRINTHS.rook.length).toBe(3 + GENERATED_LABYRINTHS.rook.length);
  });

  it("Bishop keeps its 2 hand-authored labyrinths", () => {
    expect(LABYRINTHS.bishop.length).toBe(2 + GENERATED_LABYRINTHS.bishop.length);
  });

  it("Knight keeps its 5 hand-authored labyrinths", () => {
    expect(LABYRINTHS.knight.length).toBe(5 + GENERATED_LABYRINTHS.knight.length);
  });

  it("Pawn keeps its 4 hand-authored labyrinths", () => {
    expect(LABYRINTHS.pawn.length).toBe(4 + GENERATED_LABYRINTHS.pawn.length);
  });

  it("Queen keeps its 3 hand-authored labyrinths", () => {
    expect(LABYRINTHS.queen.length).toBe(3 + GENERATED_LABYRINTHS.queen.length);
  });

  it("King now has at least 1 labyrinth (was empty pre-Phase B.2)", () => {
    expect(LABYRINTHS.king.length).toBeGreaterThanOrEqual(1);
  });
});

describe("LABYRINTHS.king — King Shelter I shape", () => {
  it("king-lab-1 is wired with the expected start/target/obstacles", () => {
    const lab = LABYRINTHS.king[0];
    expect(lab.id).toBe("king-lab-1");
    // e1 → a1 (queenside shelter).
    expect(lab.startPos).toEqual({ file: 4, rank: 0 });
    expect(lab.targetPos).toEqual({ file: 0, rank: 0 });
    // Single obstacle on c1 forces the diagonal sidestep.
    expect(lab.obstacles).toEqual([{ file: 2, rank: 0 }]);
    expect(lab.optimalMoves).toBe(4);
  });
});
