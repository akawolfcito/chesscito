import { NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { upsertRecord, type LabyrinthRecord } from "@/lib/labyrinth-builder/store";
import { parseCsv, buildCatalog, renderGeneratedModule } from "../../../../../scripts/import-puzzles";

export const runtime = "nodejs";

const ROOT = resolve(process.cwd());
const JSON_PATH = resolve(ROOT, "content/labyrinths.json");
const CSV_PATH = resolve(ROOT, "content/puzzles.csv");
const GEN_PATH = resolve(ROOT, "src/lib/game/generated/puzzles.generated.ts");

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }
  const records: LabyrinthRecord[] = existsSync(JSON_PATH)
    ? (JSON.parse(readFileSync(JSON_PATH, "utf8")) as LabyrinthRecord[])
    : [];
  return NextResponse.json({ ok: true, records });
}

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }
  let rec: LabyrinthRecord;
  try {
    rec = (await req.json()) as LabyrinthRecord;
  } catch {
    return NextResponse.json({ ok: false, errors: ["invalid JSON"] }, { status: 400 });
  }
  const recs: LabyrinthRecord[] = existsSync(JSON_PATH)
    ? (JSON.parse(readFileSync(JSON_PATH, "utf8")) as LabyrinthRecord[])
    : [];
  const next = upsertRecord(recs, rec);
  const csvRows = existsSync(CSV_PATH)
    ? parseCsv(readFileSync(CSV_PATH, "utf8"))
    : [["kind", "piece", "fen", "target", "mover", "tier", "tags", "explanation", "id"]];
  const cat = buildCatalog(csvRows, next);
  if (cat.errors.length) {
    return NextResponse.json({ ok: false, errors: cat.errors }, { status: 400 });
  }
  mkdirSync(dirname(GEN_PATH), { recursive: true });
  writeFileSync(JSON_PATH, JSON.stringify(next, null, 2) + "\n");
  writeFileSync(GEN_PATH, renderGeneratedModule(cat));
  return NextResponse.json({ ok: true, saved: rec, warnings: cat.warnings });
}
