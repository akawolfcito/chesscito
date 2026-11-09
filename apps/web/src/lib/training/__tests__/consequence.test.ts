import { describe, expect, it } from "vitest";

import {
  DIAGONAL_RUN,
  EXERCISES,
  KNIGHT_TOUR,
  LABYRINTHS,
  PROMOTION_RUN,
  QUEENS,
  SAFE_PATH,
} from "@/lib/game/exercises";
import type { PieceId } from "@/lib/game/types";
import { buildTrainingPath, type TrainingNode } from "@/lib/training/path";
import {
  coverageLaneIds,
  projectSpecialTrainingLane,
  starlessLaneIds,
  type SignaturePools,
} from "@/lib/training/special-training-lane";
import { resolveConsequence } from "@/lib/training/consequence";

/* Paths are built from the REAL catalog through the REAL projection — the same
 * two things the screen feeds `buildTrainingPath`. Hand-written node fixtures
 * would lie twice over: exercise ids are not sequential, and the raw labyrinth
 * lane is not the lane the player sees (the king's raw lane holds 1 level, its
 * projected lane holds 3). Nothing authored is pinned: every id and count below
 * is read off the catalog at call time. */

const POOLS: SignaturePools = {
  diagonalRun: DIAGONAL_RUN,
  knightTour: KNIGHT_TOUR,
  queens: QUEENS,
  safePath: SAFE_PATH,
  promotionRun: PROMOTION_RUN,
};

const LANE = projectSpecialTrainingLane(LABYRINTHS, POOLS);

type PathOptions = {
  /** Exercise ids completed, all at 3★. */
  completedExercises?: readonly string[];
  /** Lane ids completed (any best value marks completion). */
  completedLane?: readonly string[];
  badgeClaimed?: boolean;
};

function buildPath(piece: PieceId, options: PathOptions = {}): TrainingNode[] {
  const stars: Record<string, number> = {};
  for (const id of options.completedExercises ?? []) stars[id] = 3;
  const labyrinthBests: Record<string, number | null> = {};
  for (const id of options.completedLane ?? []) labyrinthBests[id] = 1;
  return buildTrainingPath({
    piece,
    progress: { piece, currentId: null, stars },
    labyrinthBests,
    badgeClaimed: options.badgeClaimed ?? false,
    catalog: { exercises: EXERCISES, labyrinths: LANE },
    coverageIds: coverageLaneIds(POOLS, piece),
    starlessIds: starlessLaneIds(POOLS, piece),
  });
}

/** Exercise ids of `piece`, in catalog order. */
function exerciseIds(piece: PieceId): string[] {
  return EXERCISES[piece].map((exercise) => exercise.id);
}

/** Projected lane ids of `piece`, in lane order. */
function laneIds(piece: PieceId): string[] {
  return LANE[piece].map((level) => level.id);
}

/** Enough exercises to clear the compound first-challenge gate
 *  (LABYRINTH_UNLOCK_THRESHOLD stars AND LABYRINTH_MIN_EXERCISES solves). */
function gateClearingExercises(piece: PieceId): string[] {
  return exerciseIds(piece).slice(0, 3);
}

describe("resolveConsequence — challenge_unlocked (AC-1)", () => {
  it("announces the challenge that this attempt opened", () => {
    const piece: PieceId = "rook";
    const lane = laneIds(piece);
    const opened = gateClearingExercises(piece);

    const before = buildPath(piece, { completedExercises: opened });
    const after = buildPath(piece, {
      completedExercises: opened,
      completedLane: [lane[0]],
    });

    expect(resolveConsequence(before, after)).toEqual({
      kind: "challenge_unlocked",
      nodeId: lane[1],
    });
  });
});

describe("resolveConsequence — lane floor (AC-8)", () => {
  it("counts the challenge lane when the attempt opened nothing", () => {
    const piece: PieceId = "rook";
    const lane = laneIds(piece);
    const opened = gateClearingExercises(piece);
    const allButLast = lane.slice(0, -1);

    const before = buildPath(piece, {
      completedExercises: opened,
      completedLane: allButLast,
    });
    const after = buildPath(piece, {
      completedExercises: opened,
      completedLane: lane,
    });

    // Finishing the lane is a consequence, never a dead end (AC-4): the rung
    // fires and the copy names the crown.
    expect(resolveConsequence(before, after)).toEqual({
      kind: "lane_progress",
      done: lane.length,
      total: lane.length,
    });
  });

  it("counts the exercise lane against the badge GATE, not the pool", () => {
    const piece: PieceId = "rook";
    const exercises = exerciseIds(piece);
    // Four solves: past the compound challenge gate (so nothing unlocks here)
    // and still short of the badge gate.
    const before = buildPath(piece, {
      completedExercises: exercises.slice(0, 3),
    });
    const after = buildPath(piece, {
      completedExercises: exercises.slice(0, 4),
    });

    // `required` is read off the path, never pinned: the pool is dynamic (the
    // Supabase overlay appends exercises) and the gate scales with it.
    const gate = after.find((node) => node.kind === "badge")?.unlock;
    expect(gate?.type).toBe("completion");
    const required = gate?.type === "completion" ? gate.min : -1;

    expect(required).toBeLessThan(exercises.length);
    expect(resolveConsequence(before, after)).toEqual({
      kind: "badge_progress",
      done: 4,
      required,
    });
  });

  it("has no exercise floor above the gate — those solves move nothing", () => {
    const piece: PieceId = "rook";
    const exercises = exerciseIds(piece);
    const gate = buildPath(piece).find((node) => node.kind === "badge")?.unlock;
    const required = gate?.type === "completion" ? gate.min : -1;

    // Already past the gate before this attempt, so the badge does not flip
    // here either: there is genuinely nothing to announce.
    const before = buildPath(piece, {
      completedExercises: exercises.slice(0, required),
    });
    const after = buildPath(piece, {
      completedExercises: exercises.slice(0, required + 1),
    });

    expect(resolveConsequence(before, after)).toBeNull();
  });
});

describe("resolveConsequence — precedence (AC-3)", () => {
  it("announces the challenge an exercise opened, not the badge count", () => {
    const piece: PieceId = "rook";
    const exercises = exerciseIds(piece);
    const lane = laneIds(piece);

    // The solve that clears the compound gate. Both rungs apply: it opened a
    // challenge AND it moved the badge count. Only the higher one is said.
    const before = buildPath(piece, {
      completedExercises: exercises.slice(0, 2),
    });
    const after = buildPath(piece, {
      completedExercises: exercises.slice(0, 3),
    });

    expect(resolveConsequence(before, after)).toEqual({
      kind: "challenge_unlocked",
      nodeId: lane[0],
    });
  });
});

describe("resolveConsequence — null is half the design (AC-7, B2)", () => {
  it("says nothing when the attempt changed nothing", () => {
    const piece: PieceId = "rook";
    const done = {
      completedExercises: gateClearingExercises(piece),
      completedLane: [laneIds(piece)[0]],
    };

    // Replaying a finished challenge re-fires the overlay. A state-based
    // resolver would re-announce the same "1 of 4" every single time.
    expect(resolveConsequence(buildPath(piece, done), buildPath(piece, done)))
      .toBeNull();
  });

  it("refuses two snapshots that describe different catalogs", () => {
    const opened = gateClearingExercises("rook");
    const before = buildPath("rook", { completedExercises: opened });
    const after = buildPath("bishop", {
      completedExercises: gateClearingExercises("bishop"),
    });

    expect(resolveConsequence(before, after)).toBeNull();
  });
});

describe("resolveConsequence — every piece, through the projected lane", () => {
  it("counts the lane the player sees, never the raw labyrinth catalog", () => {
    for (const piece of Object.keys(LANE) as PieceId[]) {
      const lane = laneIds(piece);
      const opened = gateClearingExercises(piece);
      const before = buildPath(piece, {
        completedExercises: opened,
        completedLane: lane.slice(0, -1),
      });
      const after = buildPath(piece, {
        completedExercises: opened,
        completedLane: lane,
      });

      expect(resolveConsequence(before, after), piece).toEqual({
        kind: "lane_progress",
        done: lane.length,
        total: lane.length,
      });
    }
  });
});

describe("resolveConsequence — stale-snapshot guard (AC-5)", () => {
  it("refuses a `before` that never hydrated", () => {
    const piece: PieceId = "rook";
    const exercises = exerciseIds(piece);
    const lane = laneIds(piece);
    const gate = buildPath(piece).find((node) => node.kind === "badge")?.unlock;
    const required = gate?.type === "completion" ? gate.min : -1;

    // An empty `before` is what a path built before localStorage hydrates
    // looks like. Against a real `after` it reads as the player finishing
    // nine levels in one attempt — and would announce a badge they earned
    // days ago. One attempt completes exactly ONE playable node.
    const unhydrated = buildPath(piece);
    const after = buildPath(piece, {
      completedExercises: exercises.slice(0, required),
      completedLane: [lane[0]],
    });

    expect(resolveConsequence(unhydrated, after)).toBeNull();
  });
});

describe("resolveConsequence — mastery (AC-3, AC-4)", () => {
  it("beats the lane floor when the last challenge lands the crown", () => {
    const piece: PieceId = "rook";
    const exercises = exerciseIds(piece);
    const lane = laneIds(piece);
    const gate = buildPath(piece).find((node) => node.kind === "badge")?.unlock;
    const required = gate?.type === "completion" ? gate.min : -1;
    const earned = exercises.slice(0, required);

    const before = buildPath(piece, {
      completedExercises: earned,
      completedLane: lane.slice(0, -1),
      badgeClaimed: true,
    });
    const after = buildPath(piece, {
      completedExercises: earned,
      completedLane: lane,
      badgeClaimed: true,
    });

    // The lane floor also applies here (4 of 4). Mastery outranks it: the
    // highest rung is announced, never both.
    expect(resolveConsequence(before, after)).toEqual({ kind: "mastery" });
  });
});

describe("resolveConsequence — the gate belongs to the milestone modal", () => {
  /* Playtest 2026-08-08: crossing the gate fired BOTH this line and the
   * `piece-badge-eligible` milestone modal — which announces the same thing a
   * beat later AND carries the real Claim button. `milestones.ts:82-96` proves
   * they share one trigger (`pieceCompletedExercises >= pieceRequiredExercises`,
   * no wallet condition), so this rung was never adding information: it was the
   * "celebrate the same thing twice" the brief forbids, in its weaker form. */

  it("stays silent on the solve that crosses the gate", () => {
    const piece: PieceId = "rook";
    const exercises = exerciseIds(piece);
    const gate = buildPath(piece).find((node) => node.kind === "badge")?.unlock;
    const required = gate?.type === "completion" ? gate.min : -1;

    const before = buildPath(piece, {
      completedExercises: exercises.slice(0, required - 1),
    });
    const after = buildPath(piece, {
      completedExercises: exercises.slice(0, required),
    });

    // The floor does not cover it either: at `done === required` the exercise
    // lane is above its gate, so the line is null and the modal stands alone.
    expect(resolveConsequence(before, after)).toBeNull();
  });

  it("announces the challenge a lane solve opened, gate crossed or not", () => {
    const piece: PieceId = "rook";
    const exercises = exerciseIds(piece);
    const lane = laneIds(piece);
    const gate = buildPath(piece).find((node) => node.kind === "badge")?.unlock;
    const required = gate?.type === "completion" ? gate.min : -1;

    // Badge already earned and unclaimed: `available` stays true from the
    // moment it is won until it is claimed. A state-based resolver would
    // re-announce it on every one of these attempts.
    const earned = exercises.slice(0, required);
    const before = buildPath(piece, { completedExercises: earned });
    const after = buildPath(piece, {
      completedExercises: earned,
      completedLane: [lane[0]],
    });

    expect(resolveConsequence(before, after)).toEqual({
      kind: "challenge_unlocked",
      nodeId: lane[1],
    });
  });
});
