/**
 * Prod-safe content catalog builder. Extracted from scripts/import-puzzles.ts
 * (2026-06-17, db-backed-content Phase 0) so that `app/` routes — the dev
 * builder route today, the DB-overlay write/read paths next — can import the
 * FEN→catalog validator WITHOUT pulling the script's CLI/fs entrypoint into the
 * prod bundle. Pure: no node:fs, no process side-effects. The CLI (`main()` +
 * the argv guard) stays in scripts/import-puzzles.ts, which re-exports these.
 */
import type { Exercise, ExerciseTier, PieceId } from "@/lib/game/types";
import { mapFenPuzzle, parseFenBoard, puzzleId, posToSquare, type PuzzleInput, type MappedPuzzle } from "@/lib/game/fen-puzzle";
import { computeExerciseBfs } from "@/lib/game/exercise-bfs";
import { pivotBfs } from "@/lib/game/diagonal-run";
import { lintPuzzle } from "@/lib/content/lint";

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
  /** Routing within Special Training. Absent → "labyrinth" (back-compat: every
   *  existing content/labyrinths.json row). `"diagonal-run"` routes the record to
   *  the Diagonal Run bucket (GENERATED_DIAGONAL_RUN) instead — same source file, a
   *  separate runtime bucket. Design: docs/audits/2026-07-15-bishop-d1-*. */
  kind?: "labyrinth" | "diagonal-run";
  /* Pedagogy (A1) — curated copy. `title` is what the drawer renders; the
   * linter requires all four on curated pieces. */
  principle?: string; title?: string; playerPrompt?: string; learningObjective?: string;
  /** Soft-delete flag. A disabled record stays in content/*.json (so it can
   *  be re-enabled from the builder) but is excluded from the generated
   *  catalog, so the game never surfaces it. Absent/false → live. */
  disabled?: boolean;
};

// content/exercises.json shares the labyrinth record shape; the only
// difference is the bucket it routes to (`kind:"exercise"`).
export type ExerciseRecord = LabyrinthRecord;

export type BuiltCatalog = {
  exercises: Record<PieceId, Exercise[]>;
  labyrinths: Record<PieceId, Exercise[]>;
  /** Diagonal Run pool (kind:"diagonal-run"). A separate runtime bucket even
   *  though it shares content/labyrinths.json as its source. Never overlaps labs. */
  diagonalRun: Record<PieceId, Exercise[]>;
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

export type BuildCatalogOptions = {
  /** Enforce complete pedagogy on curated pieces (lib/content/lint.ts).
   *
   *  ON for `pnpm import-puzzles` — the gate everything must cross before it can
   *  ship. A curated exercise with no title does not compile there, which is
   *  what makes the "Exercise N" fallback unreachable in the shipped catalog.
   *
   *  OFF by default, because the other callers are AUTHORING paths, and a draft
   *  is allowed to be incomplete:
   *   - the Supabase overlay has no columns for the four fields yet, so
   *     enforcing it would silently drop every rook row the builder publishes;
   *   - the builder's write routes would refuse a rook exercise until their UI
   *     grows the fields.
   *  Both still meet the gate at import time, which fails loudly and early. */
  requirePedagogy?: boolean;
};

export function buildCatalog(
  rows: string[][],
  labRecords: LabyrinthRecord[] = [],
  exerciseRecords: ExerciseRecord[] = [],
  options: BuildCatalogOptions = {},
): BuiltCatalog {
  const requirePedagogy = options.requirePedagogy ?? false;
  const errors: string[] = [];
  const warnings: string[] = [];
  const exercises = emptyByPiece();
  const labyrinths = emptyByPiece();
  const diagonalRun = emptyByPiece();
  const descriptions: Record<string, string> = {};
  const seenIds = new Set<string>();
  const seenPositions = new Set<string>();

  const [header = [], ...body] = rows;
  const col = (name: string) => header.indexOf(name);
  for (const n of ["kind", "piece", "fen", "target", "tier"]) {
    if (header.length && col(n) < 0) errors.push(`missing required column '${n}'`);
  }
  if (errors.length) return { exercises, labyrinths, diagonalRun, descriptions, errors, warnings };

  const addPuzzle = (
    input: PuzzleInput, label: string, idOverride: string | undefined, order: number,
  ) => {
    let mapped: MappedPuzzle;
    try { mapped = mapFenPuzzle(input); } catch (e) { errors.push(`${label}: ${(e as Error).message}`); return; }
    // A9 — an exercise blocker is drawn as the player's own KNIGHT, because that
    // is what every one of them is. `obstacles` carries squares, not piece types,
    // so the board cannot check the claim: if content ever ships a white bishop as
    // a blocker, the square would quietly render a knight and the board would lie
    // about the position. Rather than widen `obstacles` (that is the shared
    // BFS-state generalization — plan §15.6.3/§15.7.1, deliberately not open yet),
    // the gate holds the content to what the art can tell the truth about.
    // Labyrinths are exempt: their obstacles are stone walls, so the piece behind
    // them is never drawn.
    //
    // ⚠️ TEMPORARY INVARIANT — DELETE THIS RULE when the obstacle model carries the
    // real piece type. At that point the board draws whatever the FEN says, the art
    // can no longer lie, and this gate stops protecting anything: it only narrows
    // what authors may write. It is scaffolding, not a design goal.
    if (input.kind === "exercise" || input.kind === "diagonal-run") {
      const moverSq = posToSquare(mapped.startPos);
      const notKnights = [...parseFenBoard(input.fen).entries()]
        .filter(([sq, p]) => sq !== moverSq && p.color === "w" && p.type !== "knight")
        .map(([sq, p]) => `${p.type} on ${sq}`);
      if (notKnights.length) {
        errors.push(
          `${label}: ${input.kind} blockers must be white knights (the board draws them as knights); found ${notKnights.join(", ")}`,
        );
        return;
      }
    }
    const probe: Exercise = { id: "probe", optimalMoves: 0, ...toExerciseFields(mapped) };
    const bfs = computeExerciseBfs(input.piece, probe);
    // Lint BEFORE the solvability bail-out: a target buried under a blocker is
    // ALSO unsolvable, and "no path" alone sends the author hunting for a routing
    // bug instead of the one square at fault.
    const lint = lintPuzzle(input.piece, mapped, bfs?.optimalMoves ?? 0, label, {
      requirePedagogy,
    });
    errors.push(...lint.errors);
    warnings.push(...lint.warnings);
    if (lint.errors.length) return;
    if (!bfs) { errors.push(`${label}: unsolvable (no path) from ${posToSquare(mapped.startPos)} to ${posToSquare(mapped.targetPos)}`); return; }
    // Diagonal Run contract (D1): the level must be solvable under glide-pivot
    // transitions (the game's own semantics, NOT the free-bishop BFS), and
    // start/target must share a colour — a bishop never leaves its colour. The
    // stored optimalMoves is overridden with the PIVOT optimum below.
    let diagonalRunOptimal: number | null = null;
    if (input.kind === "diagonal-run") {
      const { startPos: s, targetPos: t, obstacles: obs = [] } = mapped;
      if ((s.file + s.rank) % 2 !== (t.file + t.rank) % 2) {
        errors.push(`${label}: diagonal-run start ${posToSquare(s)} and target ${posToSquare(t)} are different colours — the target is unreachable`);
        return;
      }
      const pv = pivotBfs(s, t, obs);
      if (!pv.reachable) {
        errors.push(`${label}: diagonal-run target ${posToSquare(t)} is unreachable by pivot turns from ${posToSquare(s)}`);
        return;
      }
      diagonalRunOptimal = pv.optimalMoves;
    }
    const id = idOverride || puzzleId(input.piece, `${input.kind}|${input.fen}|${input.target}|${input.mover ?? ""}`);
    if (seenIds.has(id)) { errors.push(`${label}: duplicate id '${id}'`); return; }
    seenIds.add(id);
    const positionKey = `${input.piece.trim()}|${input.fen.trim()}|${input.target.trim()}`;
    if (seenPositions.has(positionKey)) {
      warnings.push(`${label}: duplicate position (same piece+fen+target as an earlier puzzle)`);
    }
    seenPositions.add(positionKey);
    const exercise = { id, optimalMoves: diagonalRunOptimal ?? bfs.optimalMoves, ...toExerciseFields(mapped) } as Exercise & { __order?: number };
    exercise.__order = order;
    if (input.kind === "diagonal-run") diagonalRun[input.piece].push(exercise);
    else if (input.kind === "labyrinth") labyrinths[input.piece].push(exercise);
    else exercises[input.piece].push(exercise);
    // The descriptions map is what `resolveExerciseDescription` renders in the
    // drawer, so the curated TITLE owns it. `objective` stays the fallback for
    // uncurated pieces (it is authoring prose, which is why it never read well
    // as a row label — and why every row said "Exercise N" instead).
    const rowLabel = mapped.title ?? mapped.objective;
    if (rowLabel) descriptions[id] = rowLabel;
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
    if (rec.disabled) continue; // soft-deleted → excluded from the catalog
    if (!PIECES.includes(rec.piece)) { errors.push(`labyrinths.json '${rec.id ?? rec.fen}': bad piece`); continue; }
    addPuzzle({
      kind: rec.kind ?? "labyrinth", piece: rec.piece, tier: rec.tier ?? "medium", fen: rec.fen,
      target: rec.target, mover: rec.mover, tags: rec.tags, explanation: rec.explanation,
      principle: rec.principle, title: rec.title,
      playerPrompt: rec.playerPrompt, learningObjective: rec.learningObjective,
    }, `labyrinths.json '${rec.id ?? rec.fen}'`, rec.id, rec.order);
  }

  for (const rec of exerciseRecords) {
    if (rec.disabled) continue; // soft-deleted → excluded from the catalog
    if (!PIECES.includes(rec.piece)) { errors.push(`exercises.json '${rec.id ?? rec.fen}': bad piece`); continue; }
    addPuzzle({
      kind: "exercise", piece: rec.piece, tier: rec.tier ?? "medium", fen: rec.fen,
      target: rec.target, mover: rec.mover, tags: rec.tags, explanation: rec.explanation,
      principle: rec.principle, title: rec.title,
      playerPrompt: rec.playerPrompt, learningObjective: rec.learningObjective,
    }, `exercises.json '${rec.id ?? rec.fen}'`, rec.id, rec.order);
  }

  // Both buckets sort by (order, id) then strip the __order sort key. order
  // is the authored catalog index, so the round-trip preserves the live
  // training-path order exactly (CSV/legacy callers pass order 0 → id-sort).
  for (const p of PIECES) {
    const byOrderThenId = (
      a: Exercise & { __order?: number },
      b: Exercise & { __order?: number },
    ) => ((a.__order ?? 0) - (b.__order ?? 0)) || a.id.localeCompare(b.id);
    (exercises[p] as (Exercise & { __order?: number })[]).sort(byOrderThenId);
    (labyrinths[p] as (Exercise & { __order?: number })[]).sort(byOrderThenId);
    (diagonalRun[p] as (Exercise & { __order?: number })[]).sort(byOrderThenId);
    for (const e of exercises[p] as (Exercise & { __order?: number })[]) delete e.__order;
    for (const e of labyrinths[p] as (Exercise & { __order?: number })[]) delete e.__order;
    for (const e of diagonalRun[p] as (Exercise & { __order?: number })[]) delete e.__order;
  }
  return { exercises, labyrinths, diagonalRun, descriptions, errors, warnings };
}

export function renderGeneratedModule(cat: BuiltCatalog): string {
  const j = (v: unknown) => JSON.stringify(v, null, 2);
  return `// AUTO-GENERATED by scripts/import-puzzles.ts — DO NOT EDIT by hand.
// Source: content/puzzles.csv + content/labyrinths.json + content/exercises.json. Regenerate: pnpm import-puzzles
import type { Exercise, PieceId } from "@/lib/game/types";

export const GENERATED_EXERCISES: Record<PieceId, Exercise[]> = ${j(cat.exercises)};

export const GENERATED_LABYRINTHS: Record<PieceId, Exercise[]> = ${j(cat.labyrinths)};

export const GENERATED_DIAGONAL_RUN: Record<PieceId, Exercise[]> = ${j(cat.diagonalRun)};

export const GENERATED_EXERCISE_DESCRIPTIONS: Record<string, string> = ${j(cat.descriptions)};
`;
}
