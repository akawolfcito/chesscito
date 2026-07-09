import { describe, expect, it } from "vitest";

import { EXERCISES, PLAYABLE_PIECES } from "@/lib/game/exercises";
import {
  POINTS_PER_STAR,
  getMaxScoreForPiece,
  getMaxSubmittableScore,
} from "@/lib/game/score";

describe("score — the submittable ceiling is derived from the catalog", () => {
  it("scores a piece at 3 stars per exercise", () => {
    for (const piece of PLAYABLE_PIECES) {
      expect(getMaxScoreForPiece(piece)).toBe(
        EXERCISES[piece].length * 3 * POINTS_PER_STAR,
      );
    }
  });

  it("takes the ceiling from the largest pool, so no piece can out-score it", () => {
    const ceiling = getMaxSubmittableScore();

    for (const piece of PLAYABLE_PIECES) {
      expect(getMaxScoreForPiece(piece)).toBeLessThanOrEqual(ceiling);
    }
    expect(ceiling).toBe(
      Math.max(...PLAYABLE_PIECES.map((p) => getMaxScoreForPiece(p))),
    );
  });

  it("tracks the real catalog: 10 exercises × 3★ × 100 pts = 3000", () => {
    // Guards the regression: /api/sign-score capped at 1500, which is the
    // ceiling for a 5-exercise pool. The pools grew to 10 and the cap did
    // not, so every player past 15★ got a 400 on the on-chain save.
    expect(getMaxSubmittableScore()).toBe(3000);
  });

  it("follows a catalog with different pool sizes", () => {
    const tiny = { rook: [{ id: "r-1" }, { id: "r-2" }] } as unknown as Parameters<
      typeof getMaxScoreForPiece
    >[1];

    expect(getMaxScoreForPiece("rook", tiny)).toBe(600);
  });
});
