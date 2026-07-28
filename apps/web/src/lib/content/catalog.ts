/**
 * Prod-safe content catalog builder. Extracted from scripts/import-puzzles.ts
 * (2026-06-17, db-backed-content Phase 0) so that `app/` routes — the dev
 * builder route today, the DB-overlay write/read paths next — can import the
 * FEN→catalog validator WITHOUT pulling the script's CLI/fs entrypoint into the
 * prod bundle. Pure: no node:fs, no process side-effects. The CLI (`main()` +
 * the argv guard) stays in scripts/import-puzzles.ts, which re-exports these.
 */
import type { BoardPosition, ContentAccess, Exercise, ExerciseTier, PieceId } from "@/lib/game/types";
import { mapFenPuzzle, parseFenBoard, puzzleId, posToSquare, isCoverageKind, usesOwnSolver, type PuzzleInput, type MappedPuzzle } from "@/lib/game/fen-puzzle";
import { computeExerciseBfs } from "@/lib/game/exercise-bfs";
import { pivotBfs } from "@/lib/game/diagonal-run";
import { reachableSquares } from "@/lib/game/knight-tour";
import { maxQueens } from "@/lib/game/queens";
import { safePathOptimalMoves } from "@/lib/game/safe-path";
import {
  promotionRunSolve,
  isPromotable,
  PROMOTABLE_PIECES,
} from "@/lib/game/promotion-run";
import { CURATED_PIECES, lintPieceSequence, lintPuzzle } from "@/lib/content/lint";

/** Floor for a shippable Knight's Tour level, in reachable squares. Below this
 *  the "puzzle" is a knight boxed into a corner with a jump or two — the founder
 *  tunes feel in the builder, but this catches a level that is not a game. */
const TOUR_MIN_REACHABLE = 8;

/** Floor for a shippable queens level, in TOTAL queens (the level's own queen
 *  included). Below this there is no game to play: at 1 the board is sealed, and
 *  at 2-3 the whole level is over in a tap or two. */
const QUEENS_MIN_CEILING = 4;

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
  id?: string; piece: PieceId; fen: string; mover?: string;
  /** Required except on the TARGETLESS kinds (`knight-tour`, `queens`, which have
   *  no destination, and `promotion-run`, whose destination is a rank). */
  target?: string;
  tier?: ExerciseTier; tags?: string[]; explanation?: string; order: number;
  /** Additive content entitlement. Missing stays backwards-compatible base. */
  access?: ContentAccess;
  /** `promotion-run` only, and REQUIRED there: the piece the level asks the pawn
   *  to crown (P3). Flat in the JSON because that is what an author types; it
   *  becomes the typed `mission` on the way into the catalog. */
  promoteTo?: PieceId;
  /** Routing within Special Training. Absent → "labyrinth" (back-compat: every
   *  existing content/labyrinths.json row). `"diagonal-run"` routes the record to
   *  the Diagonal Run bucket (GENERATED_DIAGONAL_RUN) instead — same source file, a
   *  separate runtime bucket. Design: docs/audits/2026-07-15-bishop-d1-*. */
  kind?:
    | "labyrinth"
    | "diagonal-run"
    | "knight-tour"
    | "queens"
    | "safe-path"
    | "promotion-run";
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
  /** Knight's Tour pool (kind:"knight-tour"). Same story as diagonalRun: one
   *  source file, its own bucket. `optimalMoves` here means the REACHABLE
   *  CEILING (squares - 1), not a shortest path — a tour maximises, it never
   *  arrives. Grade it with tourStars, never labyrinthStars. */
  knightTour: Record<PieceId, Exercise[]>;
  /** N-Queens pool (kind:"queens"). Its own bucket, same source file.
   *  `optimalMoves` is the queens the PLAYER places: the ceiling minus the one
   *  the level starts with, so `optimalMoves + 1` is the score's denominator —
   *  the same arithmetic the tour uses. Grade it with tourStars.
   *
   *  Unlike the tour's, this ceiling is EXACT rather than an upper bound: it
   *  comes from a solver that backtracks the real placement, so it is always
   *  achievable and the pass line is always playable. */
  queens: Record<PieceId, Exercise[]>;
  /** Safe Path pool (kind:"safe-path"). Its own bucket, same source file.
   *  Graded by ARRIVAL, so unlike the coverage kinds `optimalMoves` is a move
   *  count — lower is better — and it feeds `labyrinthStars`, never tourStars.
   *
   *  It is NOT the generic exercise BFS: that one walks the king by
   *  `getKingMoves`, which knows nothing about threats and would route him
   *  through a watched square. Only `safePathOptimalMoves` reads the attack
   *  map, so only it can measure the route the player is allowed to take. */
  safePath: Record<PieceId, Exercise[]>;
  /** Promotion Run pool (kind:"promotion-run"). Its own bucket, same source file.
   *  `optimalMoves` is a move count like safe-path's — but ⛔ it does NOT grade the
   *  player, and it must never reach a star function. Every winning run from rank r
   *  is exactly `7 - r` moves long (see :286-291), so `labyrinthStars` would award
   *  three stars to everyone, forever. The grader is `promotionRunStars(failures)`
   *  (promotion-run.ts:73); the dispatch lives in lib/scores/attempt-grading.ts.
   *  The number here is the authoring measure of the solved route, and nothing else.
   *
   *  Measured by `promotionRunSolve` and by nothing else. The generic BFS is not
   *  merely imprecise here, it is wrong in kind: it would walk the pawn onto
   *  empty diagonals, which is the one move a pawn may never make, and the whole
   *  lesson of the game. */
  promotionRun: Record<PieceId, Exercise[]>;
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
  const knightTour = emptyByPiece();
  const queens = emptyByPiece();
  const safePath = emptyByPiece();
  const promotionRun = emptyByPiece();
  const descriptions: Record<string, string> = {};
  const seenIds = new Set<string>();
  const seenPositions = new Set<string>();

  const [header = [], ...body] = rows;
  const col = (name: string) => header.indexOf(name);
  for (const n of ["kind", "piece", "fen", "target", "tier"]) {
    if (header.length && col(n) < 0) errors.push(`missing required column '${n}'`);
  }
  if (errors.length) return { exercises, labyrinths, diagonalRun, knightTour, queens, safePath, promotionRun, descriptions, errors, warnings };

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
    // The coverage kinds have no destination, so there is no path to verify —
    // the contract is a CEILING, and it replaces the BFS optimum. Everything
    // below (a path BFS, "unsolvable (no path)") asks about a target the level
    // does not have.
    let coverageCeiling: number | null = null;
    if (input.kind === "knight-tour") {
      // The tour's contract is the REACHABLE SET (spec §1): covering N squares
      // costs N-1 moves.
      const reach = reachableSquares(mapped.startPos, mapped.obstacles ?? []);
      // A pocket this small is not a game — it is a knight with nowhere to go.
      // Cheap to author by accident (one wall too many) and invisible until a
      // player opens it, so it fails at import instead.
      if (reach.length < TOUR_MIN_REACHABLE) {
        errors.push(
          `${label}: knight-tour reaches only ${reach.length} square(s) from ` +
            `${posToSquare(mapped.startPos)} — a level needs at least ${TOUR_MIN_REACHABLE}. ` +
            `Check the walls boxing the knight in.`,
        );
        return;
      }
      coverageCeiling = reach.length - 1;
    }
    if (input.kind === "queens") {
      // Queens are SOLVED, not surveyed (spec §2). `maxQueens` backtracks the
      // real placement, so this ceiling is exact — an authored N above the true
      // maximum would make the level silently impossible, which is the trap the
      // tour's BFS upper bound walked into. Derive it, never trust it.
      const ceiling = maxQueens([mapped.startPos], mapped.obstacles ?? []);
      if (ceiling < QUEENS_MIN_CEILING) {
        errors.push(
          `${label}: queens has a ceiling of ${ceiling} queen(s) from ` +
            `${posToSquare(mapped.startPos)} — a level needs at least ${QUEENS_MIN_CEILING}. ` +
            `Check the blocks crowding the board.`,
        );
        return;
      }
      // Minus the queen the level starts with: the player places the rest, and
      // `optimalMoves + 1` is the denominator the score divides by.
      coverageCeiling = ceiling - 1;
    }
    // Safe Path is graded by ARRIVAL, so it is not a coverage kind — but the
    // generic BFS still cannot measure it. That BFS walks the king with
    // `getKingMoves`, which models friendly blockers and knows nothing about
    // threats: it would route him straight through a watched square and store a
    // route the player is not allowed to take. Only `safePathOptimalMoves`
    // reads the attack map, so it is the authority and the generic BFS is
    // skipped rather than overridden.
    //
    // `null` means UNWINNABLE — the refuge is watched, or the king is sealed in.
    // Measured here, reported after the lint (see below).
    let safePathOptimal: number | null = null;
    if (input.kind === "safe-path") {
      safePathOptimal = safePathOptimalMoves(
        mapped.startPos,
        mapped.targetPos,
        mapped.enemies ?? [],
        mapped.obstacles ?? [],
      );
    }
    // Promotion Run — same shape as safe-path above, and for a stronger reason.
    // The generic BFS is not merely blind to threats here, it does not know the
    // pawn: it would route it diagonally across empty squares, which is the one
    // move a pawn may never make, and the whole lesson of the game.
    //
    // The MISSION is checked first, and before the lint, because it is the win
    // condition (P3) and no route check can see it fail: a level asking for a
    // king walks the board perfectly and is still unwinnable on the last rank.
    // ⚠️ `optimalMoves` here is NOT a difficulty measure, and cannot be: every
    // move a pawn makes — push or capture — advances exactly one rank, so EVERY
    // winning run from rank r is exactly `7 - r` moves long. The number is the
    // same for the level's easiest and hardest routes. What separates them is
    // WHICH squares, so the path is kept: the captures are the only thing worth
    // counting, and they cannot be read off the length.
    let promotionRunPath: BoardPosition[] | null = null;
    let promotionRunOptimal: number | null = null;
    if (input.kind === "promotion-run") {
      const promoteTo = input.mission?.promoteTo;
      if (!promoteTo) {
        errors.push(
          `${label}: promotion-run needs a mission — set 'promoteTo'. The level asks the ` +
            `player to crown a named piece; without one it has no win condition. Not ` +
            `defaulted to a queen on purpose: choosing IS the mechanic.`,
        );
        return;
      }
      if (!isPromotable(promoteTo)) {
        errors.push(
          `${label}: a pawn cannot promote to ${promoteTo} — the mission is unwinnable. ` +
            `Promote to one of: ${PROMOTABLE_PIECES.join(", ")}.`,
        );
        return;
      }
      promotionRunPath = promotionRunSolve(
        mapped.startPos,
        mapped.enemies ?? [],
        mapped.obstacles ?? [],
        { promoteTo },
      );
      promotionRunOptimal = promotionRunPath?.length ?? null;
    }
    const probe: Exercise = { id: "probe", optimalMoves: 0, ...toExerciseFields(mapped) };
    const bfs = usesOwnSolver(input.kind) ? null : computeExerciseBfs(input.piece, probe);
    // Lint BEFORE the solvability bail-out: a target buried under a blocker is
    // ALSO unsolvable, and "no path" alone sends the author hunting for a routing
    // bug instead of the one square at fault.
    const lint = lintPuzzle(input.piece, mapped, coverageCeiling ?? safePathOptimal ?? promotionRunOptimal ?? bfs?.optimalMoves ?? 0, label, {
      requirePedagogy,
    });
    errors.push(...lint.errors);
    warnings.push(...lint.warnings);
    if (lint.errors.length) return;
    // No run reaches the last rank alive. The causes all look different to an
    // author and identical to the solver, so the message lists them: the message
    // IS the debugging surface, there is no route to stare at.
    if (input.kind === "promotion-run" && promotionRunOptimal === null) {
      errors.push(
        `${label}: promotion-run has no winning run from ${posToSquare(mapped.startPos)} — ` +
          `the pawn is watched where it stands, or sealed in with nothing to capture, or the ` +
          `only way to the last rank is a diagonal with no victim on it. Remember a pawn ` +
          `cannot change file without capturing, and that every victim is ALIVE until it is ` +
          `eaten: check what the enemies watch on the way, not just at the end.`,
      );
      return;
    }
    // A Promotion Run that never has to capture is not this game. The pawn's one
    // lesson is that it cannot change file without capturing; a run that pushes
    // straight up an open file never asks the question, and the enemies are
    // scenery. Same call as safe-path's warning below: playable, so a warning.
    //
    // Captures are counted by FILE CHANGES, which is exact rather than clever: a
    // pawn has no other way to leave its file. That is the entire game, stated as
    // arithmetic.
    if (input.kind === "promotion-run" && promotionRunPath !== null) {
      const files = [mapped.startPos, ...promotionRunPath].map((p) => p.file);
      const captures = files.filter((f, i) => i > 0 && f !== files[i - 1]).length;
      if (captures === 0) {
        warnings.push(
          `${label}: promotion-run's run never has to capture — the pawn marches straight up ` +
            `its file. The level is playable but teaches nothing: a pawn only changes file by ` +
            `capturing, so a run that never does is a walk. Seal the file with a wall and put ` +
            `something on a diagonal.`,
        );
      }
    }
    // Reported here rather than where it is measured, for the same reason as
    // the line below: the lint names the one square at fault, and "no safe
    // route" alone sends the author hunting for a routing bug instead.
    if (input.kind === "safe-path" && safePathOptimal === null) {
      errors.push(
        `${label}: safe-path has no safe route from ${posToSquare(mapped.startPos)} to ` +
          `${posToSquare(mapped.targetPos)} — the refuge is watched, or the king is sealed in ` +
          `by the enemies. Reachable is not achievable: check what the enemies see, not the walls.`,
      );
      return;
    }
    // A Safe Path level earns its threats only if they change the answer. The
    // king's shortest possible walk is the Chebyshev distance; if the safe route
    // is exactly that long, a shortest route was never watched and the player
    // strolls past the danger without ever having to read it.
    //
    // A WARNING, not an error: unlike a tour with nowhere to jump, this level is
    // still playable, and the founder tunes feel in the builder. Telling him the
    // threats are decorative beats refusing to build his draft.
    if (input.kind === "safe-path" && safePathOptimal !== null) {
      const naive = Math.max(
        Math.abs(mapped.startPos.file - mapped.targetPos.file),
        Math.abs(mapped.startPos.rank - mapped.targetPos.rank),
      );
      if (safePathOptimal <= naive) {
        warnings.push(
          `${label}: safe-path route is ${safePathOptimal} moves, the same as an unguarded ` +
            `king walk — the threats never force a detour. The level is playable but teaches nothing.`,
        );
      }
    }
    // Every kind with its own solver has already reported its own failure, in its
    // own words, by the time this runs. This line is the generic BFS's verdict,
    // so it must not speak for a game the BFS never measured — and it would speak
    // NONSENSE for the targetless kinds, whose start and target are the same
    // square: "no path from c2 to c2" is not a bug an author can act on.
    if (!bfs && coverageCeiling === null && safePathOptimal === null && promotionRunOptimal === null && input.kind !== "promotion-run") { errors.push(`${label}: unsolvable (no path) from ${posToSquare(mapped.startPos)} to ${posToSquare(mapped.targetPos)}`); return; }
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
    const id = idOverride || puzzleId(input.piece, `${input.kind}|${input.fen}|${input.target ?? ""}|${input.mover ?? ""}`);
    if (seenIds.has(id)) { errors.push(`${label}: duplicate id '${id}'`); return; }
    seenIds.add(id);
    const positionKey = `${input.piece.trim()}|${input.fen.trim()}|${input.target?.trim() ?? ""}`;
    if (seenPositions.has(positionKey)) {
      warnings.push(`${label}: duplicate position (same piece+fen+target as an earlier puzzle)`);
    }
    seenPositions.add(positionKey);
    const exercise = { id, optimalMoves: coverageCeiling ?? safePathOptimal ?? promotionRunOptimal ?? diagonalRunOptimal ?? bfs!.optimalMoves, ...toExerciseFields(mapped) } as Exercise & { __order?: number };
    exercise.__order = order;
    if (input.kind === "promotion-run") promotionRun[input.piece].push(exercise);
    else if (input.kind === "safe-path") safePath[input.piece].push(exercise);
    else if (input.kind === "queens") queens[input.piece].push(exercise);
    else if (input.kind === "knight-tour") knightTour[input.piece].push(exercise);
    else if (input.kind === "diagonal-run") diagonalRun[input.piece].push(exercise);
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
      access: rec.access,
      // Flat in the JSON, typed from here on. A missing one is not defaulted to a
      // queen: promotion-run REQUIRES a mission, and a silent default would make
      // the level's win condition depend on a forgotten field.
      mission: rec.promoteTo ? { promoteTo: rec.promoteTo } : undefined,
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
      access: rec.access,
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
    (knightTour[p] as (Exercise & { __order?: number })[]).sort(byOrderThenId);
    (queens[p] as (Exercise & { __order?: number })[]).sort(byOrderThenId);
    (safePath[p] as (Exercise & { __order?: number })[]).sort(byOrderThenId);
    (promotionRun[p] as (Exercise & { __order?: number })[]).sort(byOrderThenId);
    for (const e of exercises[p] as (Exercise & { __order?: number })[]) delete e.__order;
    for (const e of labyrinths[p] as (Exercise & { __order?: number })[]) delete e.__order;
    for (const e of diagonalRun[p] as (Exercise & { __order?: number })[]) delete e.__order;
    for (const e of knightTour[p] as (Exercise & { __order?: number })[]) delete e.__order;
    for (const e of queens[p] as (Exercise & { __order?: number })[]) delete e.__order;
    for (const e of safePath[p] as (Exercise & { __order?: number })[]) delete e.__order;
    for (const e of promotionRun[p] as (Exercise & { __order?: number })[]) delete e.__order;

    // Pacing is a property of the sequence, so it can only be judged once the
    // bucket is in its final training-path order — hence here, after the sort,
    // not inside the per-puzzle loop where `lintPuzzle` runs.
    //
    // Only the `exercises` bucket, and only for curated pieces: the other
    // buckets are one signature game per piece rather than a graded ladder,
    // and an uncurated piece has no curriculum to pace yet.
    //
    // Warnings only, by design (lib/content/lint.ts). Pushing these into
    // `errors` would put the game builder back to breaking the build on every
    // save, which is the exact failure this replaced.
    if (CURATED_PIECES.includes(p)) {
      warnings.push(...lintPieceSequence({ piece: p, exercises: exercises[p] }).warnings);
    }
  }
  return { exercises, labyrinths, diagonalRun, knightTour, queens, safePath, promotionRun, descriptions, errors, warnings };
}

export function renderGeneratedModule(cat: BuiltCatalog): string {
  const j = (v: unknown) => JSON.stringify(v, null, 2);
  return `// AUTO-GENERATED by scripts/import-puzzles.ts — DO NOT EDIT by hand.
// Source: content/puzzles.csv + content/labyrinths.json + content/exercises.json. Regenerate: pnpm import-puzzles
import type { Exercise, PieceId } from "@/lib/game/types";

export const GENERATED_EXERCISES: Record<PieceId, Exercise[]> = ${j(cat.exercises)};

export const GENERATED_LABYRINTHS: Record<PieceId, Exercise[]> = ${j(cat.labyrinths)};

export const GENERATED_DIAGONAL_RUN: Record<PieceId, Exercise[]> = ${j(cat.diagonalRun)};

export const GENERATED_KNIGHT_TOUR: Record<PieceId, Exercise[]> = ${j(cat.knightTour)};

export const GENERATED_QUEENS: Record<PieceId, Exercise[]> = ${j(cat.queens)};

export const GENERATED_SAFE_PATH: Record<PieceId, Exercise[]> = ${j(cat.safePath)};

export const GENERATED_PROMOTION_RUN: Record<PieceId, Exercise[]> = ${j(cat.promotionRun)};

export const GENERATED_EXERCISE_DESCRIPTIONS: Record<string, string> = ${j(cat.descriptions)};
`;
}
