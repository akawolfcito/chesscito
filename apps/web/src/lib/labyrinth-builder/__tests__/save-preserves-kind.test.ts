import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildCatalog, type LabyrinthRecord, type BuiltCatalog } from "@/lib/content/catalog";
import type { PieceId } from "@/lib/game/types";
import { isThreatKind, type PuzzleKind } from "@/lib/game/fen-puzzle";
import {
  buildFenBlock,
  deriveStateFromFen,
  extraFields,
  type BuilderState,
} from "../state";

/**
 * AC-7 — a load→save of a signature game keeps its kind. This is the flow that
 * used to DESTROY queens end to end: the builder Save wrote a record with no
 * kind, and the catalog filed it as a plain labyrinth.
 *
 * The test reproduces the REAL builder Save path (read → derive → buildFenBlock →
 * write), NOT the lib shortcut (toLabyrinthRecord). The two differ: Save carries
 * the untouched fields through `extraFields` and re-serializes the FEN, which is
 * exactly where the kind used to fall off (SESSION note on the AC-2 gap). If the
 * UI's record construction regresses, this fails; a lib-only test would not.
 */
const records = JSON.parse(
  readFileSync(resolve(process.cwd(), "content/labyrinths.json"), "utf8"),
) as LabyrinthRecord[];

/** The state the UI builds on load (handleEditRecord). */
function load(rec: LabyrinthRecord): BuilderState {
  const d = deriveStateFromFen(rec.fen, rec.piece, rec.mover ?? "");
  if (!d.ok) throw new Error(d.error);
  return {
    kind: (rec.kind ?? "labyrinth") as PuzzleKind,
    piece: rec.piece,
    start: d.start,
    goal: rec.target ?? null,
    walls: d.walls,
    // Mirrors handleEditRecord: a threat kind (safe-path, promotion-run) keeps
    // its typed enemies; a pawn keeps its capture targets; everything else has none.
    enemies: isThreatKind((rec.kind ?? "labyrinth") as PuzzleKind) || rec.piece === "pawn" ? d.enemies : [],
    promoteTo: rec.promoteTo,
    order: rec.order,
    explanation: rec.explanation,
    tier: rec.tier,
    tags: rec.tags,
    id: rec.id,
  };
}

/** The record the UI Save POSTs — the exact spread in page.tsx handleSave. */
function saveRecord(original: LabyrinthRecord, state: BuilderState): LabyrinthRecord {
  return {
    ...extraFields(original),
    id: state.id || undefined,
    piece: state.piece,
    ...buildFenBlock(state),
    promoteTo: state.promoteTo,
    explanation: state.explanation || undefined,
    tier: state.tier || undefined,
    tags: state.tags && state.tags.length ? state.tags : undefined,
    order: state.order,
  } as LabyrinthRecord;
}

/** The black pieces on a FEN placement, sorted — the typed enemies of a threat
 *  level. If a load→save drops them, this shrinks and the level stops teaching. */
function blackPieces(fen: string): string[] {
  return (fen.split(" ")[0].match(/[a-z]/g) ?? []).sort();
}

const BUCKET_OF: Record<string, keyof BuiltCatalog> = {
  queens: "queens",
  "knight-tour": "knightTour",
  "promotion-run": "promotionRun",
  "safe-path": "safePath",
};

// The signature kinds authored through the builder. Diagonal Run has its own
// etapa-4 test. Safe Path joins here at etapa 7, when its typed enemies must
// survive the round-trip — the loss that motivated the whole redesign.
for (const kind of ["queens", "knight-tour", "promotion-run", "safe-path"] as const) {
  const sample = records.find((r) => r.kind === kind);

  describe(`save preserves kind — ${kind}`, () => {
    it("has a real record", () => {
      expect(sample).toBeTruthy();
    });

    it("a load→save keeps it in its own bucket, never labyrinth", () => {
      const rec = sample!;
      const saved = saveRecord(rec, load(rec));
      const cat = buildCatalog([], [saved], []);
      expect(cat.errors).toEqual([]);

      const piece = rec.piece as PieceId;
      const bucket = BUCKET_OF[kind] as Exclude<keyof BuiltCatalog, "descriptions" | "errors" | "warnings">;
      expect((cat[bucket] as Record<PieceId, unknown[]>)[piece]).toHaveLength(1);
      expect(cat.labyrinths[piece]).toHaveLength(0);
    });

    it("keeps every typed enemy through the round-trip", () => {
      const rec = sample!;
      const saved = saveRecord(rec, load(rec));
      expect(blackPieces(saved.fen)).toEqual(blackPieces(rec.fen));
    });
  });
}
