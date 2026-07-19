/* ── Integrated Training Path — Slice 1 (path core) ────────────────
 * Spec: docs/specs/integrated-training-path.md
 *
 * Pure derivation layer: composes the existing EXERCISES + LABYRINTHS
 * catalogs and the existing progress stores into one per-piece node
 * path. NO persistence, NO React, NO IO — callers feed progress in,
 * the path comes out. TrainingNode is a view-model, never stored.
 * ----------------------------------------------------------------- */

import type { Exercise, PieceId, PieceProgress } from "@/lib/game/types";
import {
  badgeRequiredCount,
  EXERCISES,
  isBadgeEarned,
  LABYRINTHS,
  labyrinthStars,
} from "@/lib/game/exercises";
import { tourStars } from "@/lib/game/tour-score";

/** Injected catalog for the training path (default = baseline). Phase 2c
 *  passes the merged (baseline ⊕ overlay) catalog. */
export type TrainingCatalog = {
  exercises: Record<PieceId, Exercise[]>;
  labyrinths: Record<PieceId, Exercise[]>;
};

export type TrainingNodeKind = "exercise" | "labyrinth" | "badge" | "mastery";

export type TrainingNodeStatus = "locked" | "available" | "complete";

export type UnlockRule =
  | { type: "always" }
  /** Piece totalStars (exercise stars ONLY — labyrinth stars never count). */
  | { type: "stars"; min: number }
  /** Distinct exercises completed (≥1★) — the badge gate. `min` is 80% of the
   *  pool from `badgeRequiredCount`. */
  | { type: "completion"; min: number }
  /** That node must be complete first. */
  | { type: "node"; nodeId: string };

export type TrainingNode = {
  /** Exercise id | labyrinth id | `badge:{piece}` | `mastery:{piece}` */
  id: string;
  kind: TrainingNodeKind;
  piece: PieceId;
  unlock: UnlockRule;
  status: TrainingNodeStatus;
  /** Best stars for exercise/labyrinth nodes; null for milestone nodes. */
  stars: number | null;
  /** False for ludic content whose result is preserved without feeding stars. */
  awardsStars?: boolean;
};

export type TrainingPathInput = {
  piece: PieceId;
  /** Existing id-keyed progress (chesscito:progress:{piece}). Stars are
   *  read by exerciseId (sparse map; absent id = not played → 0). */
  progress: PieceProgress;
  /** Existing best-moves map (chesscito:labyrinth-best:{piece}).
   *  Absent/null entry = labyrinth never completed. */
  labyrinthBests: Record<string, number | null>;
  /** On-chain claim state. Always false for guests — mastery stays
   *  gated behind the wallet claim by design (founder decision 2026-06-11). */
  badgeClaimed: boolean;
  /** Injected catalog (default = baseline EXERCISES/LABYRINTHS). */
  catalog?: TrainingCatalog;
  /** Ids in the labyrinth lane graded by COVERAGE rather than by move count, so
   *  the node picks `tourStars` over `labyrinthStars`. The Knight's Tour and
   *  N-Queens are both in here — hence the neutral name: a second game asking
   *  the same question is what a `queensIds` parallel would have hidden.
   *
   *  These games ride the labyrinth machinery (nav, unlock, completion) but not
   *  its grader: their best is COVERAGE and their optimalMoves is a ceiling, so
   *  `best <= optimalMoves` always holds — labyrinthStars' top band. Unrouted,
   *  every run scores 3 stars, dead ends included. Absent/empty = none, and the
   *  labyrinth lane is untouched. */
  coverageIds?: ReadonlySet<string>;
  /** Completion remains best-backed, but these nodes always expose zero stars. */
  starlessIds?: ReadonlySet<string>;
};

export type PieceMastery = "none" | "badge" | "mastered";

/** First labyrinth of a piece unlocks at this many exercise stars.
 *  Flat for every piece in v1 (Queen/King asymmetry accepted). */
export const LABYRINTH_UNLOCK_THRESHOLD = 6;

/** Companion floor to LABYRINTH_UNLOCK_THRESHOLD. Stars alone let a perfect
 *  player unlock the maze on exercise 2, colliding with the first reward.
 *  The floor keeps the two milestones a solve apart. */
export const LABYRINTH_MIN_EXERCISES = 3;

export function buildTrainingPath(input: TrainingPathInput): TrainingNode[] {
  const {
    piece,
    progress,
    labyrinthBests,
    badgeClaimed,
    coverageIds,
    starlessIds,
  } = input;
  const exercisesCatalog = input.catalog?.exercises ?? EXERCISES;
  const labyrinthsCatalog = input.catalog?.labyrinths ?? LABYRINTHS;
  // Across-pool exercise mastery: sum the best stars in the id-map. Sparse
  // map → unset ids contribute 0. Labyrinth stars never count here.
  const totalStars = Object.values(progress.stars).reduce(
    (sum, value) => sum + value,
    0,
  );
  // Same sparse map as totalStars, counting only entries with value > 0 — a
  // present 0 means "played, scored nothing", NOT a completion.
  const completedExercises = Object.values(progress.stars).filter(
    (value) => value > 0,
  ).length;
  const meetsFirstLabGate =
    totalStars >= LABYRINTH_UNLOCK_THRESHOLD &&
    completedExercises >= LABYRINTH_MIN_EXERCISES;

  // Exercise nodes follow the authored catalog `order` (EXERCISES[piece] is
  // order-sorted at import time). Stars are read by exerciseId — immune to
  // catalog reordering.
  const exerciseNodes: TrainingNode[] = exercisesCatalog[piece].map((exercise) => {
    const stars = progress.stars[exercise.id] ?? 0;
    return {
      id: exercise.id,
      kind: "exercise" as const,
      piece,
      unlock: { type: "always" as const },
      status: stars > 0 ? ("complete" as const) : ("available" as const),
      stars,
    };
  });

  // The in-game sequence follows the authored catalog `order` (NOT
  // difficulty). LABYRINTHS[piece] is already sorted by (order, id) at
  // import time, so we consume it as-is — the author controls the order.
  const orderedLabyrinths = labyrinthsCatalog[piece];

  const labyrinthNodes: TrainingNode[] = [];
  for (const [index, labyrinth] of orderedLabyrinths.entries()) {
    const best = labyrinthBests[labyrinth.id] ?? null;
    const complete = best !== null;
    const unlock: UnlockRule =
      index === 0
        ? { type: "stars", min: LABYRINTH_UNLOCK_THRESHOLD }
        : { type: "node", nodeId: orderedLabyrinths[index - 1].id };
    const previousComplete =
      index === 0 || labyrinthNodes[index - 1].status === "complete";
    const unlocked = index === 0 ? meetsFirstLabGate : previousComplete;
    labyrinthNodes.push({
      id: labyrinth.id,
      kind: "labyrinth",
      piece,
      unlock,
      status: complete ? "complete" : unlocked ? "available" : "locked",
      // A coverage game's best is measured against a ceiling; a labyrinth's is
      // moves against an optimum. `optimalMoves` holds ceiling-1 for both the
      // tour (squares) and queens (queens the player places), so the total it
      // was measured against is optimalMoves + 1 either way.
      stars: !complete || starlessIds?.has(labyrinth.id)
        ? 0
        : coverageIds?.has(labyrinth.id)
          ? tourStars(best, labyrinth.optimalMoves + 1)
          : labyrinthStars(best, labyrinth.optimalMoves),
      awardsStars: !starlessIds?.has(labyrinth.id),
    });
  }

  const badgeId = `badge:${piece}`;
  const badgeNode: TrainingNode = {
    id: badgeId,
    kind: "badge",
    piece,
    unlock: {
      type: "completion",
      min: badgeRequiredCount(exercisesCatalog[piece].length),
    },
    status: badgeClaimed
      ? "complete"
      : isBadgeEarned(completedExercises, exercisesCatalog[piece].length)
        ? "available"
        : "locked",
    stars: null,
  };

  // Mastery = badge claimed + every labyrinth solved (vacuously true for
  // pieces with no labyrinths). Guests (badgeClaimed=false) never reach
  // "complete" — the crown is gated behind the on-chain claim.
  const allLabyrinthsComplete = labyrinthNodes.every(
    (node) => node.status === "complete",
  );
  const masteryNode: TrainingNode = {
    id: `mastery:${piece}`,
    kind: "mastery",
    piece,
    unlock: { type: "node", nodeId: badgeId },
    status:
      badgeNode.status === "complete"
        ? allLabyrinthsComplete
          ? "complete"
          : "available"
        : "locked",
    stars: null,
  };

  return [...exerciseNodes, ...labyrinthNodes, badgeNode, masteryNode];
}

/** Slice 3D: the next challenge the path recommends — the first
 *  labyrinth that is unlocked but not yet completed. Null means the
 *  player should just continue the normal exercise flow. Pure: the
 *  caller decides how to surface it (drawer row, contextual CTA).
 *  Guiding rule: the next challenge comes to the player, the player
 *  never searches for it. */
export function getNextChallenge(path: TrainingNode[]): TrainingNode | null {
  return (
    path.find(
      (node) => node.kind === "labyrinth" && node.status === "available",
    ) ?? null
  );
}

/** Post-lab routing: resolves what the "Continue" action should do after
 *  a labyrinth is completed (or replayed). Pure — caller owns all effects.
 *
 *  Priority order:
 *   1. Uncompleted exercise is visible and navigable → next-exercise.
 *   2. Another labyrinth is available in the path → next-labyrinth.
 *   3. Nothing left → piece-complete (caller shows PieceCompletePrompt).
 *
 *  `hasAvailableNextExercise` reflects whether the caller found a 0★
 *  visible exercise (i.e. `nextIdx >= 0` in the pool scan). */
export function resolvePostLabContinue(
  path: TrainingNode[],
  hasAvailableNextExercise: boolean,
):
  | { action: "next-exercise" }
  | { action: "next-labyrinth"; labyrinthId: string }
  | { action: "piece-complete" } {
  if (hasAvailableNextExercise) return { action: "next-exercise" };
  const nextLab = getNextChallenge(path);
  if (nextLab) return { action: "next-labyrinth", labyrinthId: nextLab.id };
  return { action: "piece-complete" };
}

export type InterleavedRow<E> =
  | { kind: "exercise"; value: E }
  | { kind: "labyrinth"; value: TrainingNode };

/** Surface redistribution D6 (presentation-only): merge the drawer's
 *  exercise rows and labyrinth nodes into ONE continuous path. The
 *  first labyrinth lands after the earliest exercises that can reach
 *  its stars unlock (ceil(min/3) at 3★ each), floored to
 *  LABYRINTH_MIN_EXERCISES so the row is never laid out before the
 *  compound gate (stars AND exercise floor) can possibly be open; each
 *  subsequent lab sits one exercise later, so the list alternates
 *  Ex → Lab → Ex → Lab. Labs left over past the last exercise append
 *  at the tail. The unlock MODEL is untouched — this orders rows, it
 *  never gates them. */
export function interleaveTrainingRows<E>(
  exercises: readonly E[],
  labyrinths: readonly TrainingNode[],
): InterleavedRow<E>[] {
  const firstUnlock = labyrinths[0]?.unlock;
  const anchor =
    firstUnlock && firstUnlock.type === "stars"
      ? Math.max(Math.ceil(firstUnlock.min / 3), LABYRINTH_MIN_EXERCISES)
      : exercises.length;
  const rows: InterleavedRow<E>[] = [];
  let labCursor = 0;
  exercises.forEach((exercise, index) => {
    // Lab i belongs after exercise position (anchor + i).
    while (labCursor < labyrinths.length && anchor + labCursor <= index) {
      rows.push({ kind: "labyrinth", value: labyrinths[labCursor] });
      labCursor += 1;
    }
    rows.push({ kind: "exercise", value: exercise });
  });
  for (; labCursor < labyrinths.length; labCursor += 1) {
    rows.push({ kind: "labyrinth", value: labyrinths[labCursor] });
  }
  return rows;
}

/** QA G1 (2026-06-11): after completing an exercise, the path flows
 *  THROUGH the labyrinths. Returns the labyrinth node when it is the
 *  immediate next interleaved row after the given exercise AND it is
 *  available (unlocked, not yet completed) — the host then enters it
 *  instead of advancing to the next exercise. Locked or completed
 *  neighbors return null and the exercise flow continues untouched. */
export function nextPendingLabyrinthAfterExercise(
  path: TrainingNode[],
  exerciseId: string,
): TrainingNode | null {
  const exercises = path.filter((node) => node.kind === "exercise");
  const labyrinths = path.filter((node) => node.kind === "labyrinth");
  const rows = interleaveTrainingRows(exercises, labyrinths);
  const position = rows.findIndex(
    (row) => row.kind === "exercise" && row.value.id === exerciseId,
  );
  if (position < 0) return null;
  const next = rows[position + 1];
  return next?.kind === "labyrinth" && next.value.status === "available"
    ? next.value
    : null;
}

/** Exercise Path Sequencing: returns the labyrinth to auto-enter after an
 *  exercise completes, covering both the happy path and the late-unlock gap.
 *
 * Case 1 — happy path: the immediate next interleaved row is an available lab
 *   (delegates to nextPendingLabyrinthAfterExercise, QA G1 preserved).
 *
 * Case 2 — late unlock/manual selection: the player can be either side of a
 *   lab's anchor when it becomes available. Find it anywhere in the
 *   interleaved path, without changing that path's presentation order.
 *
 * In the chained unlock model at most one lab is available at a time, so the
 * scan always returns at most one result. Null → continue exercise flow. */
export function getLabyrinthForAutoAdvance(
  path: TrainingNode[],
  completedExerciseId: string,
): TrainingNode | null {
  // Case 1: immediate next interleaved item is an available lab
  const immediate = nextPendingLabyrinthAfterExercise(path, completedExerciseId);
  if (immediate) return immediate;

  // Case 2: available lab elsewhere in the path. This covers a late unlock
  // behind the player and manual selection/replay before its visual anchor.
  const exercises = path.filter((n) => n.kind === "exercise");
  const labyrinths = path.filter((n) => n.kind === "labyrinth");
  const rows = interleaveTrainingRows(exercises, labyrinths);
  const currentPos = rows.findIndex(
    (r) => r.kind === "exercise" && r.value.id === completedExerciseId,
  );
  if (currentPos < 0) return null;
  for (const row of rows) {
    if (row.kind === "labyrinth" && row.value.status === "available") {
      return row.value;
    }
  }
  return null;
}

export function getPieceMastery(path: TrainingNode[]): PieceMastery {
  const mastery = path.find((node) => node.kind === "mastery");
  if (mastery?.status === "complete") return "mastered";
  const badge = path.find((node) => node.kind === "badge");
  if (badge && badge.status !== "locked") return "badge";
  return "none";
}
