import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildCatalog, type LabyrinthRecord } from "@/lib/content/catalog";
import { mapFenPuzzle } from "@/lib/game/fen-puzzle";
import { pivotBfs } from "@/lib/game/diagonal-run";
import { deriveStateFromFen, toLabyrinthRecord, type BuilderState } from "../state";
import { validateBuilder } from "../validate";

/**
 * Etapa 4 — Diagonal Run is editable end to end, and it degrades nothing.
 *
 * There is no new production code behind this stage: making the kind survive the
 * round-trip (2b) and pointing the live validator at buildCatalog (3) already
 * made a Diagonal Run safe to load, edit and save. This pins that — the flow the
 * builder actually runs (load a record → validate the draft → save it back),
 * over the REAL records, so a regression to the free-bishop view or a silent
 * degrade to "labyrinth" fails here.
 */
const records = JSON.parse(
  readFileSync(resolve(process.cwd(), "content/labyrinths.json"), "utf8"),
) as LabyrinthRecord[];
const runs = records.filter((r) => r.kind === "diagonal-run");

/** Reproduce the state the UI builds when it loads a record (handleEditRecord):
 *  mover + walls from the FEN, no enemies for a bishop, the record's real kind. */
function load(rec: LabyrinthRecord): BuilderState {
  const d = deriveStateFromFen(rec.fen, rec.piece, rec.mover ?? "");
  if (!d.ok) throw new Error(d.error);
  return {
    kind: rec.kind ?? "labyrinth",
    piece: rec.piece,
    start: d.start,
    goal: rec.target ?? null,
    walls: d.walls,
    enemies: [],
    order: rec.order,
    id: rec.id,
  };
}

describe("Diagonal Run — editable end to end (etapa 4)", () => {
  it("has real records to exercise", () => {
    expect(runs.length).toBeGreaterThan(0);
  });

  for (const rec of runs) {
    describe(`${rec.id} (${rec.title ?? ""})`, () => {
      const state = load(rec);

      it("loads into a valid, editable draft", () => {
        const res = validateBuilder(state);
        expect(res.errors).toEqual([]);
        expect(res.ok).toBe(true);
      });

      it("is measured by the PIVOT solver, not the free-bishop BFS", () => {
        const mapped = mapFenPuzzle({
          kind: "diagonal-run", piece: rec.piece, tier: "medium",
          fen: rec.fen, target: rec.target, mover: rec.mover,
        });
        const pivot = pivotBfs(mapped.startPos, mapped.targetPos, mapped.obstacles ?? []);
        expect(validateBuilder(state).optimalMoves).toBe(pivot.optimalMoves);
      });

      it("a load→save keeps it a diagonal-run (never degrades to labyrinth)", () => {
        const cat = buildCatalog([], [toLabyrinthRecord(state)], []);
        expect(cat.errors).toEqual([]);
        expect(cat.diagonalRun[rec.piece]).toHaveLength(1);
        expect(cat.labyrinths[rec.piece]).toHaveLength(0);
      });
    });
  }
});
