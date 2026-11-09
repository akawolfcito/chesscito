// One-time migration: move the hand-authored exercises from the TS literals
// in src/lib/game/exercises.ts into content/exercises.json (the builder's
// editable source). Mirrors scripts/migrate-labyrinths.ts exactly.
//
// CRITICAL: each exercise is recorded with `order = its ORIGINAL catalog
// index`. The id-keyed progress migration (Task 1) maps positional→id on the
// CURRENT catalog order, so the regenerated catalog MUST reproduce that exact
// order. `order` + the (order, id) sort in import-puzzles preserve it. Each
// exercise also keeps its original `id`, so id-keyed progress stays intact.
//
// Run with: pnpm migrate-exercises
import { EXERCISES } from "@/lib/game/exercises";
import { GENERATED_EXERCISES } from "@/lib/game/generated/puzzles.generated";
import { buildFenBlock } from "@/lib/labyrinth-builder/state";
import { posToSquare } from "@/lib/game/fen-puzzle";
import type { PieceId } from "@/lib/game/types";
import type { ExerciseRecord } from "./import-puzzles";

const PIECES: PieceId[] = ["rook", "bishop", "knight", "pawn", "queen", "king"];

async function main() {
  const { readFileSync, writeFileSync, existsSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const jsonPath = resolve("content/exercises.json");

  const existing: ExerciseRecord[] = existsSync(jsonPath)
    ? JSON.parse(readFileSync(jsonPath, "utf8"))
    : [];
  const existingIds = new Set(existing.map((r) => r.id).filter(Boolean));

  const migrated: ExerciseRecord[] = [];
  const summary: Record<string, number> = {};

  for (const piece of PIECES) {
    // Hand-authored exercises = EXERCISES[piece] entries whose id is NOT
    // already a generated record. EXERCISES is currently
    // [...HAND_AUTHORED, ...GENERATED] with GENERATED empty, so this is the
    // hand-authored array in its original index order.
    const generatedIds = new Set(
      (GENERATED_EXERCISES[piece] ?? []).map((e) => e.id),
    );
    const handAuthored = EXERCISES[piece].filter((e) => !generatedIds.has(e.id));

    summary[piece] = 0;
    handAuthored.forEach((ex, i) => {
      const goal = posToSquare(ex.targetPos);
      const captures = (ex.captureTargets ?? []).map(posToSquare);
      // Pawn "capture onto the target" lessons (isCapture, NO captureTargets):
      // the captured piece sits ON the target square. buildFenBlock only places
      // black pawns for `captures`, so add the goal there to encode the capture
      // — otherwise the FEN leaves the diagonal target empty and the round-trip
      // is unsolvable (pawns can't move diagonally to an empty square). Guarded
      // to the no-captureTargets case so pawns that merely ADVANCE onto the goal
      // (pawn-7/pawn-10, whose captures are mid-route) are untouched. Non-pawn
      // captures need no marker: their BFS reaches the target by normal movement
      // and `isCapture` is cosmetic for them.
      if (piece === "pawn" && ex.isCapture && captures.length === 0) {
        captures.push(goal);
      }
      const block = buildFenBlock({
        piece,
        start: posToSquare(ex.startPos),
        goal,
        walls: (ex.obstacles ?? []).map(posToSquare),
        captures,
        order: i,
      });
      const record: ExerciseRecord = {
        id: ex.id,
        piece,
        ...block,
        // Preserve the authored metadata the FEN block can't carry. tier
        // drives the rotation/tier-gating; tags feed telemetry. We deliberately
        // do NOT carry `objective` → `explanation`: the exercise `objective` is
        // authoring-only (types.ts) and the USER-FACING drawer copy comes from
        // editorial.ts via resolveExerciseDescription's i18n fallback. Emitting
        // it into GENERATED_EXERCISE_DESCRIPTIONS would override those labels
        // and change the live UI. (Labyrinths differ: they have no editorial
        // entries, so their explanation IS their user-facing copy.)
        ...(ex.tier ? { tier: ex.tier } : {}),
        ...(ex.tags && ex.tags.length ? { tags: ex.tags } : {}),
        order: i,
      };
      migrated.push(record);
      summary[piece] += 1;
    });
  }

  // Merge: keep existing records, append migrated whose id isn't already present.
  const merged: ExerciseRecord[] = [...existing];
  let appended = 0;
  for (const rec of migrated) {
    if (rec.id && existingIds.has(rec.id)) continue;
    merged.push(rec);
    if (rec.id) existingIds.add(rec.id);
    appended += 1;
  }

  writeFileSync(jsonPath, JSON.stringify(merged, null, 2) + "\n");

  console.log("migrate-exercises: per-piece migrated counts:");
  for (const piece of PIECES) console.log(`  - ${piece}: ${summary[piece]}`);
  console.log(
    `migrate-exercises: ${appended} record(s) appended (${existing.length} existing kept) → ${merged.length} total`,
  );

  // Sanity assertion: re-derive optimalMoves via BFS and compare to the
  // original hand-authored optimalMoves for every migrated id. Reuses the
  // same pipeline import-puzzles uses, so a mismatch means the FEN conversion
  // lost info — abort loudly rather than ship a silently-wrong catalog.
  const { buildCatalog } = await import("./import-puzzles");
  const cat = buildCatalog([], [], merged);
  if (cat.errors.length) {
    console.error("migrate-exercises: BFS build errors — encoding is wrong:");
    for (const e of cat.errors) console.error("  - " + e);
    process.exit(1);
  }
  const builtById = new Map<string, number>();
  for (const piece of PIECES) {
    for (const e of cat.exercises[piece]) builtById.set(e.id, e.optimalMoves);
  }
  const mismatches: string[] = [];
  for (const piece of PIECES) {
    const generatedIds = new Set(
      (GENERATED_EXERCISES[piece] ?? []).map((e) => e.id),
    );
    for (const ex of EXERCISES[piece].filter((e) => !generatedIds.has(e.id))) {
      const built = builtById.get(ex.id);
      if (built !== ex.optimalMoves) {
        mismatches.push(
          `${ex.id}: original optimalMoves=${ex.optimalMoves}, BFS=${built ?? "MISSING"}`,
        );
      }
    }
  }
  if (mismatches.length) {
    console.error("migrate-exercises: optimalMoves MISMATCH (conversion lost info):");
    for (const m of mismatches) console.error("  - " + m);
    process.exit(1);
  }
  console.log("migrate-exercises: all migrated optimalMoves match the originals ✓");
}

void main();
