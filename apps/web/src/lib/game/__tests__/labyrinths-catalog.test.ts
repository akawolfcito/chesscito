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

// Regression guards pin the per-piece floor. The 18 originally hand-authored
// labs were migrated into content/labyrinths.json (2026-06-16,
// scripts/migrate-labyrinths.ts), so `LABYRINTHS[piece]` now sources entirely
// from GENERATED_LABYRINTHS[piece]. Each guard checks the migrated labs are
// still present by id (the floor) and that the pool === the generated pool.
describe("LABYRINTHS catalog — per-piece counts (regression guards)", () => {
  const hasAll = (piece: PieceId, ids: string[]) => {
    const present = new Set(LABYRINTHS[piece].map((e) => e.id));
    for (const id of ids) expect(present.has(id)).toBe(true);
    // Catalog is generated-sourced — no extra hand-authored layer remains.
    expect(LABYRINTHS[piece].map((e) => e.id)).toEqual(
      GENERATED_LABYRINTHS[piece].map((e) => e.id),
    );
  };

  it("Rook ships its four Rook Rails levels (A10/A11)", () => {
    // The four migrated rook labs (rook-lab-1/2/3 + rook-gen-*) were replaced by
    // the designed Rook Rails ladder — new ids because the boards, optimal moves
    // and taught principle all changed (plan §10.3). Break Through (level 4) is
    // Phase B and deliberately absent.
    hasAll("rook", [
      "rook-rail-two-turns",
      "rook-rail-dead-end",
      "rook-rail-two-roads",
      "rook-rail-rook-run",
    ]);
  });

  it("Bishop keeps its 2 migrated labyrinths", () => {
    hasAll("bishop", ["bishop-lab-3", "bishop-lab-4"]);
  });

  it("Knight keeps its 5 migrated labyrinths", () => {
    hasAll("knight", [
      "knight-lab-1",
      "knight-lab-2",
      "knight-lab-3",
      "knight-lab-4",
      "knight-lab-5",
    ]);
  });

  it("Pawn keeps its 4 migrated labyrinths", () => {
    hasAll("pawn", ["pawn-lab-1", "pawn-lab-3", "pawn-lab-4", "pawn-lab-5"]);
  });

  it("Queen keeps its 3 migrated labyrinths", () => {
    hasAll("queen", ["queen-lab-1", "queen-lab-2", "queen-lab-3"]);
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
