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

/** Paths are derived from an injectable root (default: the working tree) so a
 *  test can point the whole read-modify-write at a tmpdir. With module-level
 *  constants the round-trip test would have to either mock fs — and stop
 *  proving anything about the real records — or write the working tree. */
function paths(root: string) {
  return {
    labs: resolve(root, "content/labyrinths.json"),
    exercises: resolve(root, "content/exercises.json"),
    csv: resolve(root, "content/puzzles.csv"),
    gen: resolve(root, "src/lib/game/generated/puzzles.generated.ts"),
  };
}

/** A record plus the bucket it was read from. Two axes, two fields: `bucket` is
 *  WHICH FILE it lives in, `kind` (on the record, untouched) is WHAT GAME it is.
 *
 *  Replaces `KindedRecord`, which did `Omit<LabyrinthRecord, "kind">` and put
 *  the bucket in `kind`'s place — so reading a record ERASED its game. That is
 *  the root cause this type retires: a queens level came back saying
 *  `kind:"labyrinth"`, and saving it wrote that lie to disk. */
export type BucketedRecord = LabyrinthRecord & { bucket: ContentBucket };

export type BaselineWriteResult =
  | { ok: true; id: string; warnings: string[] }
  | { ok: false; errors: string[] };

function readRecords(path: string): LabyrinthRecord[] {
  return existsSync(path)
    ? (JSON.parse(readFileSync(path, "utf8")) as LabyrinthRecord[])
    : [];
}

/** Read both buckets (bucket-tagged), optionally filtered. Powers the dev GET.
 *  The record's own `kind` passes through untouched — including ABSENT, which is
 *  what the 19 legit labyrinths carry and what `?? "labyrinth"` handles
 *  downstream. It is never filled in here: an invented default is how a
 *  record's game ends up decided by its reader instead of by the record. */
export function readBaselineRecords(
  filter?: ContentBucket,
  root: string = process.cwd(),
): BucketedRecord[] {
  const p = paths(root);
  const wantLabs = filter !== "exercise";
  const wantExercises = filter !== "labyrinth";
  const out: BucketedRecord[] = [];
  if (wantLabs) {
    for (const r of readRecords(p.labs)) out.push({ ...r, bucket: "labyrinth" });
  }
  if (wantExercises) {
    for (const r of readRecords(p.exercises)) out.push({ ...r, bucket: "exercise" });
  }
  return out;
}

/**
 * Validate (BFS, via buildCatalog) and persist one record to its bucket, then
 * regenerate the catalog module. The resolved id (auto-assigned with the build's
 * content-addressed scheme when absent) comes back on the result — the caller's
 * record is NOT mutated, so read it from there. On a validation failure NOTHING
 * is written.
 */
export function writeBaselineRecord(
  bucket: ContentBucket,
  record: LabyrinthRecord,
  root: string = process.cwd(),
): BaselineWriteResult {
  const p = paths(root);
  // `bucket` is a read-time tag, not part of the record — a caller that read a
  // BucketedRecord and passes it straight back would otherwise persist it (the
  // intersection type allows the extra prop through assignment). Strip it here,
  // where every write path converges, rather than trusting each caller.
  const { bucket: _bucket, ...clean } = record as BucketedRecord;
  record = clean;

  // Auto-assign a stable, content-addressed id so future saves overwrite the
  // same record (no duplicate "(no id)" rows). Same scheme as the build.
  // ⚠️ Hashes the BUCKET, not the record's kind: that is what the build does,
  // so changing it here would re-id existing content.
  if (!record.id) {
    record.id = puzzleId(
      record.piece,
      `${bucket}|${record.fen}|${record.target}|${record.mover ?? ""}`,
    );
  }

  const targetPath = bucket === "exercise" ? p.exercises : p.labs;
  // Read-modify-write the active bucket; upsertRecord replaces a matching
  // record wholesale (caller sends a complete record on edit).
  const nextTarget = upsertRecord(readRecords(targetPath), record);

  // The generated catalog is built from BOTH buckets (+ the CSV), so re-read
  // the other bucket as-is and feed both to buildCatalog.
  const labs = bucket === "exercise" ? readRecords(p.labs) : nextTarget;
  const exercises = bucket === "exercise" ? nextTarget : readRecords(p.exercises);

  const csvRows = existsSync(p.csv)
    ? parseCsv(readFileSync(p.csv, "utf8"))
    : [["kind", "piece", "fen", "target", "mover", "tier", "tags", "explanation", "id"]];
  const cat = buildCatalog(csvRows, labs, exercises);
  if (cat.errors.length) return { ok: false, errors: cat.errors };

  mkdirSync(dirname(p.gen), { recursive: true });
  writeFileSync(targetPath, JSON.stringify(nextTarget, null, 2) + "\n");
  writeFileSync(p.gen, renderGeneratedModule(cat));
  return { ok: true, id: record.id, warnings: cat.warnings };
}
