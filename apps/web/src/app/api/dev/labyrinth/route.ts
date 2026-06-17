import { NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { upsertRecord, type LabyrinthRecord } from "@/lib/labyrinth-builder/store";
import { puzzleId } from "@/lib/game/fen-puzzle";
import { parseCsv, buildCatalog, renderGeneratedModule } from "@/lib/content/catalog";

export const runtime = "nodejs";

const ROOT = resolve(process.cwd());
const LABS_PATH = resolve(ROOT, "content/labyrinths.json");
const EXERCISES_PATH = resolve(ROOT, "content/exercises.json");
const CSV_PATH = resolve(ROOT, "content/puzzles.csv");
const GEN_PATH = resolve(ROOT, "src/lib/game/generated/puzzles.generated.ts");

type PuzzleKind = "labyrinth" | "exercise";

// Records carry an optional `kind` selecting the bucket they belong to. The
// on-disk JSON files do NOT store `kind` (it is implied by the file), so we
// strip it before persisting.
type KindedRecord = LabyrinthRecord & { kind?: PuzzleKind };

function readRecords(path: string): LabyrinthRecord[] {
  return existsSync(path)
    ? (JSON.parse(readFileSync(path, "utf8")) as LabyrinthRecord[])
    : [];
}

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }
  const url = new URL(req.url);
  const filter = url.searchParams.get("kind");
  const wantLabs = filter !== "exercise";
  const wantExercises = filter !== "labyrinth";

  const records: KindedRecord[] = [];
  if (wantLabs) {
    for (const r of readRecords(LABS_PATH)) records.push({ ...r, kind: "labyrinth" });
  }
  if (wantExercises) {
    for (const r of readRecords(EXERCISES_PATH)) records.push({ ...r, kind: "exercise" });
  }
  return NextResponse.json({ ok: true, records });
}

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }
  let body: KindedRecord;
  try {
    body = (await req.json()) as KindedRecord;
  } catch {
    return NextResponse.json({ ok: false, errors: ["invalid JSON"] }, { status: 400 });
  }
  // `kind` selects the bucket; default to "labyrinth" for back-compat. It is
  // not persisted — the file the record lands in implies it.
  const kind: PuzzleKind = body.kind === "exercise" ? "exercise" : "labyrinth";
  const { kind: _kind, ...rec } = body;
  // Auto-assign a stable, content-addressed id when none is supplied so the
  // record can be overwritten on future saves (no duplicate "(no id)" rows).
  // Uses the SAME scheme as the build, so the assigned id equals the
  // generated id (keyed by the active kind).
  if (!rec.id) {
    rec.id = puzzleId(rec.piece, `${kind}|${rec.fen}|${rec.target}|${rec.mover ?? ""}`);
  }

  const targetPath = kind === "exercise" ? EXERCISES_PATH : LABS_PATH;
  // Read-modify-write the active bucket; merge-by-id preserves any unknown
  // fields on records we are not touching, and upsertRecord replaces the
  // matching record wholesale (the caller is responsible for sending a
  // complete record on edit, incl. exercise-only fields like tier/tags).
  const targetRecs = readRecords(targetPath);
  const nextTarget = upsertRecord(targetRecs, rec);

  // The generated catalog is built from BOTH buckets (+ the CSV), so we must
  // re-read the other bucket as-is and feed both to buildCatalog.
  const labs = kind === "exercise" ? readRecords(LABS_PATH) : nextTarget;
  const exercises = kind === "exercise" ? nextTarget : readRecords(EXERCISES_PATH);

  const csvRows = existsSync(CSV_PATH)
    ? parseCsv(readFileSync(CSV_PATH, "utf8"))
    : [["kind", "piece", "fen", "target", "mover", "tier", "tags", "explanation", "id"]];
  const cat = buildCatalog(csvRows, labs, exercises);
  if (cat.errors.length) {
    return NextResponse.json({ ok: false, errors: cat.errors }, { status: 400 });
  }
  mkdirSync(dirname(GEN_PATH), { recursive: true });
  writeFileSync(targetPath, JSON.stringify(nextTarget, null, 2) + "\n");
  writeFileSync(GEN_PATH, renderGeneratedModule(cat));
  return NextResponse.json({ ok: true, saved: rec, warnings: cat.warnings });
}
