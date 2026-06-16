// One-time migration: move hand-authored labyrinths from the TS literals in
// src/lib/game/exercises.ts into content/labyrinths.json (the builder's
// editable source). Preserves each labyrinth's `id` and relative `order` so the
// training-path ordering and id-keyed progress stay byte-for-byte unchanged.
//
// Run with: pnpm migrate-labyrinths
import { LABYRINTHS } from "@/lib/game/exercises";
import { GENERATED_LABYRINTHS } from "@/lib/game/generated/puzzles.generated";
import { buildFenBlock } from "@/lib/labyrinth-builder/state";
import { posToSquare } from "@/lib/game/fen-puzzle";
import type { PieceId } from "@/lib/game/types";
import type { LabyrinthRecord } from "./import-puzzles";

const PIECES: PieceId[] = ["rook", "bishop", "knight", "pawn", "queen", "king"];

async function main() {
  const { readFileSync, writeFileSync, existsSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const jsonPath = resolve("content/labyrinths.json");

  const existing: LabyrinthRecord[] = existsSync(jsonPath)
    ? JSON.parse(readFileSync(jsonPath, "utf8"))
    : [];
  const existingIds = new Set(existing.map((r) => r.id).filter(Boolean));

  const migrated: LabyrinthRecord[] = [];
  const summary: Record<string, number> = {};

  for (const piece of PIECES) {
    // Hand-authored labs = LABYRINTHS[piece] entries whose id is NOT already a
    // generated record (those literals are what we migrate; the generated test
    // record is excluded — it already lives in labyrinths.json).
    const generatedIds = new Set(
      (GENERATED_LABYRINTHS[piece] ?? []).map((e) => e.id),
    );
    const handAuthored = LABYRINTHS[piece].filter((e) => !generatedIds.has(e.id));

    summary[piece] = 0;
    handAuthored.forEach((lab, i) => {
      const block = buildFenBlock({
        piece,
        start: posToSquare(lab.startPos),
        goal: posToSquare(lab.targetPos),
        walls: (lab.obstacles ?? []).map(posToSquare),
        captures: (lab.captureTargets ?? []).map(posToSquare),
        order: i,
      });
      const record: LabyrinthRecord = {
        id: lab.id,
        piece,
        ...block,
        order: i,
      };
      migrated.push(record);
      summary[piece] += 1;
    });
  }

  // Merge: keep existing records, append migrated whose id isn't already present.
  const merged: LabyrinthRecord[] = [...existing];
  let appended = 0;
  for (const rec of migrated) {
    if (rec.id && existingIds.has(rec.id)) continue;
    merged.push(rec);
    if (rec.id) existingIds.add(rec.id);
    appended += 1;
  }

  writeFileSync(jsonPath, JSON.stringify(merged, null, 2) + "\n");

  console.log("migrate-labyrinths: per-piece migrated counts:");
  for (const piece of PIECES) console.log(`  - ${piece}: ${summary[piece]}`);
  console.log(
    `migrate-labyrinths: ${appended} record(s) appended (${existing.length} existing kept) → ${merged.length} total`,
  );

  // Sanity assertion: re-derive optimalMoves via BFS and compare to the
  // original hand-authored optimalMoves for every migrated id. Reuses the same
  // pipeline import-puzzles uses, so a mismatch means the conversion lost info.
  const { buildCatalog } = await import("./import-puzzles");
  const cat = buildCatalog([], merged);
  if (cat.errors.length) {
    console.error("migrate-labyrinths: BFS build errors — encoding is wrong:");
    for (const e of cat.errors) console.error("  - " + e);
    process.exit(1);
  }
  const builtById = new Map<string, number>();
  for (const piece of PIECES) {
    for (const e of cat.labyrinths[piece]) builtById.set(e.id, e.optimalMoves);
  }
  const mismatches: string[] = [];
  for (const piece of PIECES) {
    const generatedIds = new Set(
      (GENERATED_LABYRINTHS[piece] ?? []).map((e) => e.id),
    );
    for (const lab of LABYRINTHS[piece].filter((e) => !generatedIds.has(e.id))) {
      const built = builtById.get(lab.id);
      if (built !== lab.optimalMoves) {
        mismatches.push(
          `${lab.id}: original optimalMoves=${lab.optimalMoves}, BFS=${built ?? "MISSING"}`,
        );
      }
    }
  }
  if (mismatches.length) {
    console.error("migrate-labyrinths: optimalMoves MISMATCH (conversion lost info):");
    for (const m of mismatches) console.error("  - " + m);
    process.exit(1);
  }
  console.log("migrate-labyrinths: all migrated optimalMoves match the originals ✓");
}

void main();
