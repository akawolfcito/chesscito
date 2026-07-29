import { describe, expect, it } from "vitest";

import {
  DIAGONAL_RUN,
  KNIGHT_TOUR,
  LABYRINTHS,
  PLAYABLE_PIECES,
  PROMOTION_RUN,
  QUEENS,
  SAFE_PATH,
} from "@/lib/game/exercises";
import type { Exercise, PieceId } from "@/lib/game/types";
import {
  coverageLaneIds,
  projectSpecialTrainingLane,
  starlessLaneIds,
  type SignaturePools,
} from "@/lib/training/special-training-lane";

const BASELINE_POOLS: SignaturePools = {
  diagonalRun: DIAGONAL_RUN,
  knightTour: KNIGHT_TOUR,
  queens: QUEENS,
  safePath: SAFE_PATH,
  promotionRun: PROMOTION_RUN,
};

function ids(levels: Exercise[] | undefined): string[] {
  return (levels ?? []).map((level) => level.id);
}

function emptyLane(): Record<PieceId, Exercise[]> {
  const lane = {} as Record<PieceId, Exercise[]>;
  for (const piece of PLAYABLE_PIECES) lane[piece] = [];
  return lane;
}

describe("projectSpecialTrainingLane", () => {
  it("swaps each piece's raw labyrinths for its signature game", () => {
    const lane = projectSpecialTrainingLane(LABYRINTHS, BASELINE_POOLS);

    expect(ids(lane.bishop)).toEqual(ids(DIAGONAL_RUN.bishop));
    expect(ids(lane.knight)).toEqual(ids(KNIGHT_TOUR.knight));
    expect(ids(lane.queen)).toEqual(ids(QUEENS.queen));
    expect(ids(lane.king)).toEqual(ids(SAFE_PATH.king));
    expect(ids(lane.pawn)).toEqual(ids(PROMOTION_RUN.pawn));
  });

  it("leaves a piece with no signature game byte-identical", () => {
    const lane = projectSpecialTrainingLane(LABYRINTHS, BASELINE_POOLS);
    // The rook's signature game IS its four curated rook-rail labyrinths.
    expect(lane.rook).toBe(LABYRINTHS.rook);
  });

  it("drops every retired id from the lane it projects", () => {
    const lane = projectSpecialTrainingLane(LABYRINTHS, BASELINE_POOLS);
    for (const piece of PLAYABLE_PIECES) {
      if (piece === "rook") continue;
      for (const retired of LABYRINTHS[piece]) {
        expect(ids(lane[piece]), `${piece}`).not.toContain(retired.id);
      }
    }
  });

  it("does not mutate the catalog it was given", () => {
    const before = ids(LABYRINTHS.queen);
    projectSpecialTrainingLane(LABYRINTHS, BASELINE_POOLS);
    expect(ids(LABYRINTHS.queen)).toEqual(before);
  });

  it("treats an absent or empty pool as no signature game", () => {
    expect(projectSpecialTrainingLane(LABYRINTHS, {}).queen).toBe(
      LABYRINTHS.queen,
    );
    expect(
      projectSpecialTrainingLane(LABYRINTHS, { queens: emptyLane() }).queen,
    ).toBe(LABYRINTHS.queen);
  });

  it("resolves a piece claimed by two pools by fixed precedence, not key order", () => {
    const lane = projectSpecialTrainingLane(LABYRINTHS, {
      promotionRun: { ...emptyLane(), queen: QUEENS.queen },
      diagonalRun: { ...emptyLane(), queen: DIAGONAL_RUN.bishop },
    });
    expect(ids(lane.queen)).toEqual(ids(DIAGONAL_RUN.bishop));
  });
});

describe("coverageLaneIds / starlessLaneIds", () => {
  it("marks the tour and queens as coverage-graded", () => {
    expect([...coverageLaneIds(BASELINE_POOLS, "knight")]).toEqual(
      ids(KNIGHT_TOUR.knight),
    );
    expect([...coverageLaneIds(BASELINE_POOLS, "queen")]).toEqual(
      ids(QUEENS.queen),
    );
  });

  it("leaves the move-graded games out of the coverage set", () => {
    // Safe Path is arrival by MOVE COUNT, Promotion Run grades failures.
    expect(coverageLaneIds(BASELINE_POOLS, "king").size).toBe(0);
    expect(coverageLaneIds(BASELINE_POOLS, "pawn").size).toBe(0);
    expect(coverageLaneIds(BASELINE_POOLS, "rook").size).toBe(0);
  });

  it("marks only the tour as starless", () => {
    expect([...starlessLaneIds(BASELINE_POOLS, "knight")]).toEqual(
      ids(KNIGHT_TOUR.knight),
    );
    expect(starlessLaneIds(BASELINE_POOLS, "queen").size).toBe(0);
  });
});
