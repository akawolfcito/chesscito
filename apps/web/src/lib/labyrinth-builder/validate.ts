import { buildCatalog, type BuiltCatalog } from "@/lib/content/catalog";
import { computeExerciseBfsPath } from "@/lib/game/exercise-bfs";
import { isTargetlessKind, type PuzzleKind } from "@/lib/game/fen-puzzle";
import type { BoardPosition, Exercise, PieceId } from "@/lib/game/types";
import { toLabyrinthRecord, type BuilderState } from "./state";

export type ValidationResult = {
  ok: boolean;
  optimalMoves: number | null;
  path: BoardPosition[];
  errors: string[];
  warnings: string[];
  /** The built Exercise for a VALID draft — the same object buildCatalog files,
   *  ready to feed a real game board as Preview (behavior 10). `null` whenever
   *  the draft is invalid: never mount a board on a broken level (edge case). */
  preview: Exercise | null;
};

/** Which BuiltCatalog bucket a kind lands in — the only place that mapping
 *  lives, so reading a built record back never drifts from buildCatalog's own
 *  routing. */
const BUCKET_OF: Record<PuzzleKind, keyof BuiltCatalog & string> = {
  exercise: "exercises",
  labyrinth: "labyrinths",
  "diagonal-run": "diagonalRun",
  "knight-tour": "knightTour",
  queens: "queens",
  "safe-path": "safePath",
  "promotion-run": "promotionRun",
};

/** buildCatalog prefixes every error with the record's file+id label. Strip it
 *  so the live message matches the bare text the builder shows. */
const stripLabel = (m: string): string =>
  m.replace(/^(?:labyrinths|exercises)\.json '[^']*':\s*/, "");

/**
 * Validate a builder draft LIVE against the SAME validator that gates the save
 * (P0-4). `validateBuilder` no longer owns a second opinion: it builds the
 * record Save would write and asks `buildCatalog` — so the solvers, the
 * diagonal-run knight lint and the promotion-run mission requirement all speak
 * with one voice, and no draft the builder lets you paint can be rejected on
 * save. The only judgement left here is the AUTHOR-facing shortcut warning
 * (traced route vs the BFS optimum), which buildCatalog knows nothing about.
 *
 * `optimalMoves` and `path` are DISPLAY aids, not the verdict: the pass/fail
 * decision is buildCatalog's alone. The path highlight is computed only for the
 * kinds whose route the generic BFS actually models (exercise, labyrinth); the
 * own-solver kinds have no single route to draw.
 */
export function validateBuilder(s: BuilderState, tracedPath?: string[]): ValidationResult {
  // Author guidance for an INCOMPLETE draft — the record cannot even be built
  // yet, so this precedes delegation. Kind-aware: a targetless game has no goal.
  const preErrors: string[] = [];
  if (!s.start) preErrors.push("Set a start square.");
  if (!s.goal && !isTargetlessKind(s.kind)) preErrors.push("Set a goal square.");
  if (s.start && s.goal && s.start === s.goal) preErrors.push("Start and goal must differ.");
  if (preErrors.length) return { ok: false, optimalMoves: null, path: [], errors: preErrors, warnings: [], preview: null };

  let cat: BuiltCatalog;
  try {
    const record = toLabyrinthRecord(s);
    cat = s.kind === "exercise"
      ? buildCatalog([], [], [record])
      : buildCatalog([], [record], []);
  } catch (e) {
    return { ok: false, optimalMoves: null, path: [], errors: [(e as Error).message], warnings: [], preview: null };
  }

  const errors = cat.errors.map(stripLabel);
  const warnings = cat.warnings.map(stripLabel);
  if (errors.length) return { ok: false, optimalMoves: null, path: [], errors, warnings, preview: null };

  const built = (cat[BUCKET_OF[s.kind]] as Record<PieceId, Exercise[]>)[s.piece].find(
    (e) => e.id === "draft",
  );
  const optimalMoves = built?.optimalMoves ?? null;

  // Route highlight + shortcut warning only where the generic BFS is the real
  // solver. For the own-solver kinds the route is not a single path (a coverage
  // ceiling, an arrival under threats), so drawing one would lie.
  let path: BoardPosition[] = [];
  if ((s.kind === "exercise" || s.kind === "labyrinth") && built) {
    const bfs = computeExerciseBfsPath(s.piece, built);
    path = bfs?.path ?? [];
    if (tracedPath && bfs && tracedPath.length - 1 > bfs.optimalMoves) {
      warnings.push(
        `There is a shorter path (${bfs.optimalMoves}) than your traced route (${tracedPath.length - 1}). Add walls to remove the shortcut.`,
      );
    }
  }

  return { ok: true, optimalMoves, path, errors, warnings, preview: built ?? null };
}
