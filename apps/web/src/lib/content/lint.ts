/**
 * Semantic linter for the puzzle catalog.
 *
 * `import-puzzles` always verified that a puzzle is SOLVABLE. It never verified
 * that the puzzle STAGES WHAT IT CLAIMS. That gap shipped six exercises tagged
 * `capture` with nothing capturable on the board (the engine cannot even capture
 * with a ray piece: the ray breaks before the blocker), and one tagged
 * `blocked-rank` whose rank held zero blockers.
 *
 * The contract:
 *   the FEN is the truth · the metadata is a promise · the build fails when the
 *   promise is not kept.
 *
 * Deterministic checks are ERRORS — they are decidable from the board alone.
 * Judgement calls are WARNINGS: a heuristic that breaks the build gets switched
 * off, and then it protects nothing.
 *
 * Audit: docs/audits/2026-07-13-rook-curriculum-audit.md
 * Plan:  docs/plans/2026-07-13-rook-curriculum-implementation-plan.md §11
 */
import type { BoardPosition, Exercise, PieceId } from "@/lib/game/types";
import { posToSquare, type MappedPuzzle } from "@/lib/game/fen-puzzle";
import { computeExerciseBfs } from "@/lib/game/exercise-bfs";

export type LintResult = { errors: string[]; warnings: string[] };

const samePos = (a: BoardPosition, b: BoardPosition) =>
  a.file === b.file && a.rank === b.rank;

/**
 * Lints one mapped puzzle against its own board.
 *
 * `optimalMoves` is passed in rather than recomputed: the caller has already run
 * the BFS to build the exercise, and the decorative-obstacle check needs to
 * compare against exactly that number.
 */
export function lintPuzzle(
  piece: PieceId,
  mapped: MappedPuzzle,
  optimalMoves: number,
  label: string,
): LintResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const tags = mapped.tags ?? [];
  const obstacles = mapped.obstacles ?? [];
  const capturable = mapped.captureTargets ?? [];
  const { startPos, targetPos } = mapped;
  const at = (p: BoardPosition) => posToSquare(p);

  /* ── Errors — decidable from the board ─────────────────────────── */

  // A `capture` tag with nothing to capture. The lie that started this linter.
  if (tags.includes("capture") && capturable.length === 0 && !mapped.isCapture) {
    errors.push(
      `${label}: tagged 'capture' but no capturable piece is on the board ` +
        `(friendly blockers cannot be captured — the ray stops before them)`,
    );
  }

  // A `friendly-blocker` tag with no friendly piece to do the blocking.
  if (tags.includes("friendly-blocker") && obstacles.length === 0) {
    errors.push(`${label}: tagged 'friendly-blocker' but the board has no friendly piece`);
  }

  // `blocked-file` / `blocked-rank`: the named line must actually hold a blocker.
  // The relevant line is the mover's OR the target's — a detour is authored
  // either by shutting the piece in or by walling the destination off.
  if (tags.includes("blocked-file")) {
    const shut = obstacles.some(
      (o) => o.file === startPos.file || o.file === targetPos.file,
    );
    if (!shut) {
      errors.push(
        `${label}: tagged 'blocked-file' but neither the mover's file ` +
          `(${at(startPos)}) nor the target's (${at(targetPos)}) holds a blocker`,
      );
    }
  }
  if (tags.includes("blocked-rank")) {
    const shut = obstacles.some(
      (o) => o.rank === startPos.rank || o.rank === targetPos.rank,
    );
    if (!shut) {
      errors.push(
        `${label}: tagged 'blocked-rank' but neither the mover's rank ` +
          `(${at(startPos)}) nor the target's (${at(targetPos)}) holds a blocker`,
      );
    }
  }

  // A target buried under a blocker can never be landed on. `mapFenPuzzle`
  // happily encodes it and the BFS then reports "unsolvable", which sends the
  // author hunting for a routing bug instead of the one square at fault.
  if (obstacles.some((o) => samePos(o, targetPos))) {
    errors.push(`${label}: the target ${at(targetPos)} sits on top of a blocker`);
  }

  /* ── Warnings — judgement calls ────────────────────────────────── */

  // Decorative obstacles — the ones that can ALL come off together without the
  // puzzle changing. Testing each blocker on its own would be useless: rook-6
  // stacks parallel blockers, so removing any single one leaves the others doing
  // its job, and every last blocker looks load-bearing. So peel them off greedily
  // and keep only what the optimal route actually needs.
  //
  // rook-6 shipped 21 blockers to author a 3-move detour. Difficulty has to come
  // from the decision, not from the mess.
  if (obstacles.length > 0 && optimalMoves > 0) {
    const solvesTheSame = (kept: BoardPosition[]) => {
      const probe: Exercise = {
        id: "lint-probe",
        optimalMoves: 0,
        startPos,
        targetPos,
        obstacles: kept,
        captureTargets: mapped.captureTargets,
        isCapture: mapped.isCapture,
      };
      const bfs = computeExerciseBfs(piece, probe);
      return bfs !== null && bfs.optimalMoves === optimalMoves;
    };

    let kept = [...obstacles];
    const droppable: string[] = [];
    for (const o of obstacles) {
      const candidate = kept.filter((x) => !samePos(x, o));
      if (solvesTheSame(candidate)) {
        kept = candidate;
        droppable.push(at(o));
      }
    }
    if (droppable.length > 0) {
      warnings.push(
        `${label}: ${droppable.length}/${obstacles.length} obstacles are decorative — ` +
          `${kept.length} keep optimalMoves at ${optimalMoves}. Droppable: ${droppable.join(" ")}`,
      );
    }
  }

  return { errors, warnings };
}
