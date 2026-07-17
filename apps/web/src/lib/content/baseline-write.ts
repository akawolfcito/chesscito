/**
 * Baseline content write — db-content overlay-full (Stage 5).
 *
 * Server-only, dev-only helper (callers guard `NODE_ENV`). Owns the fs
 * read-modify-write of `content/{exercises,labyrinths}.json` plus the
 * regeneration of the generated catalog module, reusing the shared BFS
 * validator (`buildCatalog`). Extracted from `/api/dev/labyrinth` so BOTH the
 * dev route AND the dev publish proxy go through ONE path — no divergence
 * between "save" and "publish to live" (red-team P0).
 *
 * NEVER import from a non-dev surface: it touches the working tree.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { upsertRecord, type LabyrinthRecord } from "@/lib/labyrinth-builder/store";
import { puzzleId } from "@/lib/game/fen-puzzle";
import { parseCsv, buildCatalog, renderGeneratedModule } from "@/lib/content/catalog";
import type { ContentBucket } from "@/lib/content/overlay-types";

const ROOT = resolve(process.cwd());
const LABS_PATH = resolve(ROOT, "content/labyrinths.json");
const EXERCISES_PATH = resolve(ROOT, "content/exercises.json");
const CSV_PATH = resolve(ROOT, "content/puzzles.csv");
const GEN_PATH = resolve(ROOT, "src/lib/game/generated/puzzles.generated.ts");

/** A builder record tagged with the bucket it belongs to. The on-disk JSON
 *  files do NOT store `kind` (it is implied by the file). */
// The dev builder's `kind` is the BUCKET selector (exercise vs labyrinth file),
// which is a different axis from LabyrinthRecord's own routing `kind`
// (labyrinth vs pivot). Omit the record's field so the builder's ContentBucket
// wins here without the two unioning down to "labyrinth".
export type KindedRecord = Omit<LabyrinthRecord, "kind"> & { kind?: ContentBucket };

export type BaselineWriteResult =
  | { ok: true; id: string; warnings: string[] }
  | { ok: false; errors: string[] };

function readRecords(path: string): LabyrinthRecord[] {
  return existsSync(path)
    ? (JSON.parse(readFileSync(path, "utf8")) as LabyrinthRecord[])
    : [];
}

/** Read both buckets (kind-tagged), optionally filtered. Powers the dev GET. */
export function readBaselineRecords(filter?: ContentBucket): KindedRecord[] {
  const wantLabs = filter !== "exercise";
  const wantExercises = filter !== "labyrinth";
  const out: KindedRecord[] = [];
  if (wantLabs) {
    for (const r of readRecords(LABS_PATH)) out.push({ ...r, kind: "labyrinth" });
  }
  if (wantExercises) {
    for (const r of readRecords(EXERCISES_PATH)) out.push({ ...r, kind: "exercise" });
  }
  return out;
}

/**
 * Validate (BFS, via buildCatalog) and persist one record to its bucket, then
 * regenerate the catalog module. The record is mutated in place to carry a
 * resolved id (auto-assigned with the build's content-addressed scheme when
 * absent), and that id is returned. On a validation failure NOTHING is written.
 */
export function writeBaselineRecord(
  kind: ContentBucket,
  record: LabyrinthRecord,
): BaselineWriteResult {
  // Auto-assign a stable, content-addressed id so future saves overwrite the
  // same record (no duplicate "(no id)" rows). Same scheme as the build.
  if (!record.id) {
    record.id = puzzleId(
      record.piece,
      `${kind}|${record.fen}|${record.target}|${record.mover ?? ""}`,
    );
  }

  const targetPath = kind === "exercise" ? EXERCISES_PATH : LABS_PATH;
  // Read-modify-write the active bucket; upsertRecord replaces a matching
  // record wholesale (caller sends a complete record on edit).
  const nextTarget = upsertRecord(readRecords(targetPath), record);

  // The generated catalog is built from BOTH buckets (+ the CSV), so re-read
  // the other bucket as-is and feed both to buildCatalog.
  const labs = kind === "exercise" ? readRecords(LABS_PATH) : nextTarget;
  const exercises = kind === "exercise" ? nextTarget : readRecords(EXERCISES_PATH);

  const csvRows = existsSync(CSV_PATH)
    ? parseCsv(readFileSync(CSV_PATH, "utf8"))
    : [["kind", "piece", "fen", "target", "mover", "tier", "tags", "explanation", "id"]];
  const cat = buildCatalog(csvRows, labs, exercises);
  if (cat.errors.length) return { ok: false, errors: cat.errors };

  mkdirSync(dirname(GEN_PATH), { recursive: true });
  writeFileSync(targetPath, JSON.stringify(nextTarget, null, 2) + "\n");
  writeFileSync(GEN_PATH, renderGeneratedModule(cat));
  return { ok: true, id: record.id, warnings: cat.warnings };
}
