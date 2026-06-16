import type { Exercise, ExerciseTier, PieceId } from "@/lib/game/types";
import { mapFenPuzzle, puzzleId, posToSquare, type PuzzleInput, type MappedPuzzle } from "@/lib/game/fen-puzzle";
import { computeExerciseBfs } from "@/lib/game/exercise-bfs";

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

const PIECES: PieceId[] = ["rook", "bishop", "knight", "pawn", "queen", "king"];
const TIERS: ExerciseTier[] = ["easy", "medium", "hard"];

export type LabyrinthRecord = {
  id?: string; piece: PieceId; fen: string; target: string; mover?: string;
  tier?: ExerciseTier; tags?: string[]; explanation?: string; order: number;
};

export type BuiltCatalog = {
  exercises: Record<PieceId, Exercise[]>;
  labyrinths: Record<PieceId, Exercise[]>;
  descriptions: Record<string, string>;
  errors: string[];
  warnings: string[];
};

function emptyByPiece(): Record<PieceId, Exercise[]> {
  return { rook: [], bishop: [], knight: [], pawn: [], queen: [], king: [] };
}
function toExerciseFields(m: MappedPuzzle) {
  // `kind` and `piece` are not part of `Exercise`: `kind` is split into the
  // exercises/labyrinths buckets, and `piece` is encoded by the catalog key.
  const { kind: _kind, piece: _piece, ...rest } = m;
  return rest;
}

export function buildCatalog(rows: string[][], labRecords: LabyrinthRecord[] = []): BuiltCatalog {
  const errors: string[] = [];
  const warnings: string[] = [];
  const exercises = emptyByPiece();
  const labyrinths = emptyByPiece();
  const descriptions: Record<string, string> = {};
  const seenIds = new Set<string>();
  const seenPositions = new Set<string>();

  const [header = [], ...body] = rows;
  const col = (name: string) => header.indexOf(name);
  for (const n of ["kind", "piece", "fen", "target", "tier"]) {
    if (header.length && col(n) < 0) errors.push(`missing required column '${n}'`);
  }
  if (errors.length) return { exercises, labyrinths, descriptions, errors, warnings };

  const addPuzzle = (
    input: PuzzleInput, label: string, idOverride: string | undefined, order: number,
  ) => {
    let mapped: MappedPuzzle;
    try { mapped = mapFenPuzzle(input); } catch (e) { errors.push(`${label}: ${(e as Error).message}`); return; }
    const probe: Exercise = { id: "probe", optimalMoves: 0, ...toExerciseFields(mapped) };
    const bfs = computeExerciseBfs(input.piece, probe);
    if (!bfs) { errors.push(`${label}: unsolvable (no path) from ${posToSquare(mapped.startPos)} to ${posToSquare(mapped.targetPos)}`); return; }
    const id = idOverride || puzzleId(input.piece, `${input.kind}|${input.fen}|${input.target}|${input.mover ?? ""}`);
    if (seenIds.has(id)) { errors.push(`${label}: duplicate id '${id}'`); return; }
    seenIds.add(id);
    const positionKey = `${input.piece.trim()}|${input.fen.trim()}|${input.target.trim()}`;
    if (seenPositions.has(positionKey)) {
      warnings.push(`${label}: duplicate position (same piece+fen+target as an earlier puzzle)`);
    }
    seenPositions.add(positionKey);
    const exercise = { id, optimalMoves: bfs.optimalMoves, ...toExerciseFields(mapped) } as Exercise & { __order?: number };
    if (input.kind === "labyrinth") { exercise.__order = order; labyrinths[input.piece].push(exercise); }
    else exercises[input.piece].push(exercise);
    if (mapped.objective) descriptions[id] = mapped.objective;
  };

  body.forEach((r, i) => {
    const line = i + 2;
    const get = (n: string) => (col(n) >= 0 ? (r[col(n)] ?? "").trim() : "");
    const kind = get("kind"); const piece = get("piece") as PieceId; const tier = get("tier") as ExerciseTier;
    if (kind !== "exercise" && kind !== "labyrinth") { errors.push(`row ${line}: bad kind '${kind}'`); return; }
    if (!PIECES.includes(piece)) { errors.push(`row ${line}: bad piece '${piece}'`); return; }
    if (!TIERS.includes(tier)) { errors.push(`row ${line}: bad tier '${tier}'`); return; }
    addPuzzle({
      kind, piece, tier, fen: get("fen"), target: get("target"), mover: get("mover") || undefined,
      tags: get("tags") ? get("tags").split(",").map((t) => t.trim()).filter(Boolean) : undefined,
      explanation: get("explanation") || undefined,
    }, `row ${line}`, get("id") || undefined, 0);
  });

  for (const rec of labRecords) {
    if (!PIECES.includes(rec.piece)) { errors.push(`labyrinths.json '${rec.id ?? rec.fen}': bad piece`); continue; }
    addPuzzle({
      kind: "labyrinth", piece: rec.piece, tier: rec.tier ?? "medium", fen: rec.fen,
      target: rec.target, mover: rec.mover, tags: rec.tags, explanation: rec.explanation,
    }, `labyrinths.json '${rec.id ?? rec.fen}'`, rec.id, rec.order);
  }

  // exercises sort by id; labyrinths sort by (order, id) then strip __order.
  for (const p of PIECES) {
    exercises[p].sort((a, b) => a.id.localeCompare(b.id));
    (labyrinths[p] as (Exercise & { __order?: number })[]).sort(
      (a, b) => ((a.__order ?? 0) - (b.__order ?? 0)) || a.id.localeCompare(b.id),
    );
    for (const e of labyrinths[p] as (Exercise & { __order?: number })[]) delete e.__order;
  }
  return { exercises, labyrinths, descriptions, errors, warnings };
}

export function renderGeneratedModule(cat: BuiltCatalog): string {
  const j = (v: unknown) => JSON.stringify(v, null, 2);
  return `// AUTO-GENERATED by scripts/import-puzzles.ts — DO NOT EDIT by hand.
// Source: content/puzzles.csv + content/labyrinths.json. Regenerate: pnpm import-puzzles
import type { Exercise, PieceId } from "@/lib/game/types";

export const GENERATED_EXERCISES: Record<PieceId, Exercise[]> = ${j(cat.exercises)};

export const GENERATED_LABYRINTHS: Record<PieceId, Exercise[]> = ${j(cat.labyrinths)};

export const GENERATED_EXERCISE_DESCRIPTIONS: Record<string, string> = ${j(cat.descriptions)};
`;
}

async function main() {
  const { readFileSync, writeFileSync, mkdirSync, existsSync } = await import("node:fs");
  const { dirname, resolve } = await import("node:path");
  const csvPath = resolve("content/puzzles.csv");
  const jsonPath = resolve("content/labyrinths.json");
  const outPath = resolve("src/lib/game/generated/puzzles.generated.ts");
  const rows = existsSync(csvPath) ? parseCsv(readFileSync(csvPath, "utf8")) : [];
  const labs = existsSync(jsonPath) ? JSON.parse(readFileSync(jsonPath, "utf8")) : [];
  const cat = buildCatalog(rows, labs);
  if (cat.errors.length) {
    console.error(`import-puzzles: ${cat.errors.length} error(s):`);
    for (const e of cat.errors) console.error("  - " + e);
    process.exit(1);
  }
  if (cat.warnings.length) {
    console.warn(`import-puzzles: ${cat.warnings.length} warning(s):`);
    for (const w of cat.warnings) console.warn("  - " + w);
  }
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, renderGeneratedModule(cat));
  const n = Object.values(cat.exercises).flat().length + Object.values(cat.labyrinths).flat().length;
  console.log(`import-puzzles: wrote ${n} puzzles to ${outPath}`);
}
if (process.argv[1] && process.argv[1].endsWith("import-puzzles.ts")) void main();
