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
import { getValidTargets } from "@/lib/game/board";

export type LintResult = { errors: string[]; warnings: string[] };

/**
 * Pieces whose EXERCISES must carry complete pedagogy (`principle`, `title`,
 * `playerPrompt`, `learningObjective`). Missing copy is a build error here — the
 * "Exercise {n}" fallback survives in code as a defence, but for a curated piece
 * it is unreachable, because content without a title never compiles.
 *
 * A piece joins this list the moment its curriculum is curated. Rook and bishop
 * came first (2026-07-13/15); knight, pawn, queen and king followed (2026-07-15),
 * so all six are now curated and the release build enforces complete pedagogy for
 * every exercise. The runtime path (`requirePedagogy: false`) still tolerates
 * missing copy, which is what keeps non-release catalogs building.
 */
export const CURATED_PIECES: readonly PieceId[] = [
  "rook",
  "bishop",
  "knight",
  "pawn",
  "queen",
  "king",
];

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
  options: { requirePedagogy?: boolean } = {},
): LintResult {
  const requirePedagogy = options.requirePedagogy ?? true;
  const errors: string[] = [];
  const warnings: string[] = [];
  const tags = mapped.tags ?? [];
  const obstacles = mapped.obstacles ?? [];
  const capturable = mapped.captureTargets ?? [];
  const { startPos, targetPos } = mapped;
  const at = (p: BoardPosition) => posToSquare(p);

  /* ── Errors — decidable from the board ─────────────────────────── */

  // Curated pieces must say what they teach. This is the rule that kills the
  // "Exercise {n}" fallback at the source: a rook exercise with no title does
  // not compile, so it can never reach a player unnamed.
  if (requirePedagogy && mapped.kind === "exercise" && CURATED_PIECES.includes(piece)) {
    const missing = (
      [
        ["principle", mapped.principle],
        ["title", mapped.title],
        ["playerPrompt", mapped.playerPrompt],
        ["learningObjective", mapped.learningObjective],
      ] as const
    )
      .filter(([, v]) => !v)
      .map(([k]) => k);
    if (missing.length > 0) {
      errors.push(
        `${label}: ${piece} is a curated piece — missing pedagogy: ${missing.join(", ")}`,
      );
    }
  }

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

  // Decorative obstacles — the ones that can ALL come off together without
  // changing what the player DECIDES.
  //
  // Two traps, both hit for real while authoring this:
  //
  //  1. Testing each blocker on its own is useless. rook-6 stacked parallel
  //     blockers, so removing any single one left the others doing its job and
  //     all 21 looked load-bearing. The peel has to be greedy and cumulative.
  //
  //  2. Preserving `optimalMoves` alone is NOT enough, and following it is
  //     actively harmful. Peeled against that criterion, rook-6 collapses to ONE
  //     blocker with its optimal still at 3 — while the number of optimal routes
  //     goes 2 -> 7 and the first move goes from 8 choices to 11. The exercise
  //     still "measures" the same and has stopped being a decision: the detour
  //     becomes automatic. The honest invariant is the whole DECISION PROFILE.
  //
  // So: drop what changes nothing the player experiences; keep everything else.
  // The goal is the minimum set that preserves the LESSON, not the minimum set.
  if (obstacles.length > 0 && optimalMoves > 0) {
    const shipped = decisionProfile(piece, mapped, obstacles);
    if (shipped) {
      let kept = [...obstacles];
      const droppable: string[] = [];
      for (const o of obstacles) {
        const candidate = kept.filter((x) => !samePos(x, o));
        const p = decisionProfile(piece, mapped, candidate);
        if (
          p &&
          p.optimalMoves === shipped.optimalMoves &&
          p.optimalRoutes === shipped.optimalRoutes &&
          p.firstMoveChoices === shipped.firstMoveChoices
        ) {
          kept = candidate;
          droppable.push(at(o));
        }
      }
      if (droppable.length > 0) {
        warnings.push(
          `${label}: ${droppable.length}/${obstacles.length} obstacles are decorative — ` +
            `${kept.length} preserve the decision (optimal ${shipped.optimalMoves}, ` +
            `${shipped.optimalRoutes} optimal routes, ${shipped.firstMoveChoices} first moves). ` +
            `Droppable: ${droppable.join(" ")}`,
        );
      }
    }
  }

  return { errors, warnings };
}

/**
 * What the player actually experiences on a board: how long the best route is,
 * how many best routes there are, and how wide the first decision is.
 *
 * `optimalMoves` alone cannot tell a puzzle from a corridor — a board can keep
 * its move count while every choice in it evaporates. These three together can.
 */
type DecisionProfile = {
  optimalMoves: number;
  optimalRoutes: number;
  firstMoveChoices: number;
};

function decisionProfile(
  piece: PieceId,
  mapped: MappedPuzzle,
  obstacles: BoardPosition[],
): DecisionProfile | null {
  const probe: Exercise = {
    id: "lint-probe",
    optimalMoves: 0,
    startPos: mapped.startPos,
    targetPos: mapped.targetPos,
    obstacles,
    captureTargets: mapped.captureTargets,
    isCapture: mapped.isCapture,
  };
  const bfs = computeExerciseBfs(piece, probe);
  if (!bfs) return null;

  const targets = (from: BoardPosition) =>
    getValidTargets(
      piece,
      from,
      obstacles,
      mapped.isCapture ?? false,
      mapped.captureTargets,
      mapped.targetPos,
    );

  // Count the shortest routes by layered BFS, NOT by walking every branch: the
  // exhaustive walk is exponential in the optimal depth, and the 7-move rook
  // labyrinths hang it. Distances first, then dynamic programming over them —
  // a path is optimal exactly when every step increases the distance by one.
  const key = (p: BoardPosition) => `${p.file},${p.rank}`;
  const dist = new Map<string, number>([[key(mapped.startPos), 0]]);
  const order: BoardPosition[] = [mapped.startPos];
  for (let i = 0; i < order.length; i += 1) {
    const u = order[i];
    const du = dist.get(key(u))!;
    if (du >= bfs.optimalMoves) continue; // nothing past the target layer matters
    for (const m of targets(u)) {
      if (dist.has(key(m))) continue;
      dist.set(key(m), du + 1);
      order.push(m);
    }
  }

  const routes = new Map<string, number>([[key(mapped.startPos), 1]]);
  for (const u of order) {
    const du = dist.get(key(u))!;
    const wu = routes.get(key(u)) ?? 0;
    if (wu === 0 || du >= bfs.optimalMoves) continue;
    for (const m of targets(u)) {
      if (dist.get(key(m)) !== du + 1) continue; // only forward edges lie on a shortest path
      routes.set(key(m), (routes.get(key(m)) ?? 0) + wu);
    }
  }

  return {
    optimalMoves: bfs.optimalMoves,
    optimalRoutes: routes.get(key(mapped.targetPos)) ?? 0,
    firstMoveChoices: targets(mapped.startPos).length,
  };
}
