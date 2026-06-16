import { mapFenPuzzle } from "@/lib/game/fen-puzzle";
import { computeExerciseBfsPath } from "@/lib/game/exercise-bfs";
import type { BoardPosition, Exercise } from "@/lib/game/types";
import { toPuzzleInput, type BuilderState } from "./state";

export type ValidationResult = {
  ok: boolean;
  optimalMoves: number | null;
  path: BoardPosition[];
  errors: string[];
  warnings: string[];
};

/** Validate a builder state live. `tracedPath` (optional) is the author's
 *  intended route as algebraic squares; if the BFS optimal is SHORTER than the
 *  traced route, warn about an accidental shortcut (RED-TEAM B2). */
export function validateBuilder(s: BuilderState, tracedPath?: string[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!s.start) errors.push("Set a start square.");
  if (!s.goal) errors.push("Set a goal square.");
  if (s.start && s.goal && s.start === s.goal) errors.push("Start and goal must differ.");
  if (errors.length) return { ok: false, optimalMoves: null, path: [], errors, warnings };

  let exercise: Exercise;
  try {
    const mapped = mapFenPuzzle(toPuzzleInput(s));
    exercise = {
      id: "preview",
      optimalMoves: 0,
      startPos: mapped.startPos,
      targetPos: mapped.targetPos,
      obstacles: mapped.obstacles,
      captureTargets: mapped.captureTargets,
      isCapture: mapped.isCapture,
    };
  } catch (e) {
    return { ok: false, optimalMoves: null, path: [], errors: [(e as Error).message], warnings };
  }

  const bfs = computeExerciseBfsPath(s.piece, exercise);
  if (!bfs) {
    return { ok: false, optimalMoves: null, path: [], errors: ["No path: the goal is unreachable."], warnings };
  }
  if (tracedPath && tracedPath.length - 1 > bfs.optimalMoves) {
    warnings.push(
      `There is a shorter path (${bfs.optimalMoves}) than your traced route (${tracedPath.length - 1}). Add walls to remove the shortcut.`,
    );
  }
  return { ok: true, optimalMoves: bfs.optimalMoves, path: bfs.path, errors, warnings };
}
