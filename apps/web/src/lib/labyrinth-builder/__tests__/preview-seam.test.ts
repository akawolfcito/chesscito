import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { LabyrinthRecord } from "@/lib/content/catalog";
import type { PuzzleKind } from "@/lib/game/fen-puzzle";
import { deriveStateFromFen, type BuilderState } from "../state";
import { validateBuilder } from "../validate";

/**
 * The Preview seam (behavior 10): validateBuilder exposes the built Exercise for
 * a VALID draft, and null for an invalid one — so the builder never mounts a real
 * game board on a broken level. This is the load-bearing bit; whether the mounted
 * board looks right is verified by eye.
 */
const records = JSON.parse(
  readFileSync(resolve(process.cwd(), "content/labyrinths.json"), "utf8"),
) as LabyrinthRecord[];

function load(rec: LabyrinthRecord): BuilderState {
  const d = deriveStateFromFen(rec.fen, rec.piece, rec.mover ?? "");
  if (!d.ok) throw new Error(d.error);
  return {
    kind: (rec.kind ?? "labyrinth") as PuzzleKind,
    piece: rec.piece,
    start: d.start,
    goal: rec.target ?? null,
    walls: d.walls,
    enemies: rec.piece === "pawn" ? d.enemies : [],
    promoteTo: rec.promoteTo,
    order: rec.order,
    id: rec.id,
  };
}

describe("Preview seam — validateBuilder.preview", () => {
  for (const kind of ["queens", "knight-tour", "diagonal-run", "promotion-run"] as const) {
    it(`gives a mountable Exercise for a valid ${kind} draft`, () => {
      const rec = records.find((r) => r.kind === kind);
      expect(rec).toBeTruthy();
      const res = validateBuilder(load(rec!));
      expect(res.ok).toBe(true);
      expect(res.preview).not.toBeNull();
      expect(res.preview!.id).toBe("draft");
      expect(typeof res.preview!.optimalMoves).toBe("number");
    });
  }

  it("is null for an incomplete draft (no start)", () => {
    const res = validateBuilder({
      kind: "labyrinth", piece: "rook", start: null, goal: "a8",
      walls: [], enemies: [], order: 0,
    });
    expect(res.ok).toBe(false);
    expect(res.preview).toBeNull();
  });

  it("is null for a draft the catalog rejects (promotion-run without promoteTo)", () => {
    const res = validateBuilder({
      kind: "promotion-run", piece: "pawn", start: "a2", goal: null,
      walls: [], enemies: [], order: 0,
    });
    expect(res.ok).toBe(false);
    expect(res.errors.length).toBeGreaterThan(0);
    expect(res.preview).toBeNull();
  });
});
