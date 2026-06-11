/* ── Integrated Training Path — Slice 1 (path core) ────────────────
 * Spec: docs/specs/integrated-training-path.md
 *
 * Pure derivation layer: composes the existing EXERCISES + LABYRINTHS
 * catalogs and the existing progress stores into one per-piece node
 * path. NO persistence, NO React, NO IO — callers feed progress in,
 * the path comes out. TrainingNode is a view-model, never stored.
 * ----------------------------------------------------------------- */

import type { PieceId, PieceProgress } from "@/lib/game/types";
import {
  BADGE_THRESHOLD,
  EXERCISES,
  LABYRINTHS,
  labyrinthStars,
} from "@/lib/game/exercises";

export type TrainingNodeKind = "exercise" | "labyrinth" | "badge" | "mastery";

export type TrainingNodeStatus = "locked" | "available" | "complete";

export type UnlockRule =
  | { type: "always" }
  /** Piece totalStars (exercise stars ONLY — labyrinth stars never count). */
  | { type: "stars"; min: number }
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
};

export type TrainingPathInput = {
  piece: PieceId;
  /** Existing positional stars array (chesscito:progress:{piece}). */
  progress: PieceProgress;
  /** Existing best-moves map (chesscito:labyrinth-best:{piece}).
   *  Absent/null entry = labyrinth never completed. */
  labyrinthBests: Record<string, number | null>;
  /** On-chain claim state. Always false for guests — mastery stays
   *  gated behind the wallet claim by design (founder decision 2026-06-11). */
  badgeClaimed: boolean;
};

export type PieceMastery = "none" | "badge" | "mastered";

/** First labyrinth of a piece unlocks at this many exercise stars.
 *  Flat for every piece in v1 (Queen/King asymmetry accepted). */
export const LABYRINTH_UNLOCK_THRESHOLD = 6;

export function buildTrainingPath(input: TrainingPathInput): TrainingNode[] {
  const { piece, progress, labyrinthBests, badgeClaimed } = input;
  const totalStars = progress.stars.reduce((sum, value) => sum + value, 0);

  const exerciseNodes: TrainingNode[] = EXERCISES[piece].map(
    (exercise, index) => {
      const stars = progress.stars[index] ?? 0;
      return {
        id: exercise.id,
        kind: "exercise" as const,
        piece,
        unlock: { type: "always" as const },
        status: stars > 0 ? ("complete" as const) : ("available" as const),
        stars,
      };
    },
  );

  // Easy → hard ordering by optimalMoves; catalog index breaks ties so
  // the order is stable across builds (red-team P2 lab-ordering).
  const orderedLabyrinths = LABYRINTHS[piece]
    .map((labyrinth, catalogIndex) => ({ labyrinth, catalogIndex }))
    .sort(
      (a, b) =>
        a.labyrinth.optimalMoves - b.labyrinth.optimalMoves ||
        a.catalogIndex - b.catalogIndex,
    )
    .map((entry) => entry.labyrinth);

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
    const unlocked =
      index === 0
        ? totalStars >= LABYRINTH_UNLOCK_THRESHOLD
        : previousComplete;
    labyrinthNodes.push({
      id: labyrinth.id,
      kind: "labyrinth",
      piece,
      unlock,
      status: complete ? "complete" : unlocked ? "available" : "locked",
      stars: complete ? labyrinthStars(best, labyrinth.optimalMoves) : 0,
    });
  }

  const badgeId = `badge:${piece}`;
  const badgeNode: TrainingNode = {
    id: badgeId,
    kind: "badge",
    piece,
    unlock: { type: "stars", min: BADGE_THRESHOLD },
    status: badgeClaimed
      ? "complete"
      : totalStars >= BADGE_THRESHOLD
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

export function getPieceMastery(path: TrainingNode[]): PieceMastery {
  const mastery = path.find((node) => node.kind === "mastery");
  if (mastery?.status === "complete") return "mastered";
  const badge = path.find((node) => node.kind === "badge");
  if (badge && badge.status !== "locked") return "badge";
  return "none";
}
