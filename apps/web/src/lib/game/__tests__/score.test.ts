import { describe, expect, it } from "vitest";

import { EXERCISES, PLAYABLE_PIECES } from "@/lib/game/exercises";
import {
  MAX_EXERCISES_PER_PIECE,
  MAX_SUBMITTABLE_SCORE,
  POINTS_PER_STAR,
  STARS_PER_EXERCISE,
  getMaxScoreForPiece,
} from "@/lib/game/score";

describe("score — what a piece's pool can actually produce", () => {
  it("scores a piece at 3 stars per exercise", () => {
    for (const piece of PLAYABLE_PIECES) {
      expect(getMaxScoreForPiece(piece)).toBe(
        EXERCISES[piece].length * STARS_PER_EXERCISE * POINTS_PER_STAR,
      );
    }
  });

  it("follows a catalog with different pool sizes", () => {
    const tiny = { rook: [{ id: "r-1" }, { id: "r-2" }] } as unknown as Parameters<
      typeof getMaxScoreForPiece
    >[1];

    expect(getMaxScoreForPiece("rook", tiny)).toBe(600);
  });
});

describe("score — the submittable ceiling is a product invariant, not a derived value", () => {
  it("is the invariant, priced out", () => {
    expect(MAX_SUBMITTABLE_SCORE).toBe(
      MAX_EXERCISES_PER_PIECE * STARS_PER_EXERCISE * POINTS_PER_STAR,
    );
    // Pinned so raising the invariant is a deliberate edit, never a drift.
    expect(MAX_EXERCISES_PER_PIECE).toBe(100);
    expect(MAX_SUBMITTABLE_SCORE).toBe(30_000);
  });

  /**
   * THE GUARD. This is the test that keeps the ceiling from going stale the way
   * the old hardcoded 1500 did. If a baseline pool ever grows past the
   * invariant, this fails and forces a deliberate bump of
   * MAX_EXERCISES_PER_PIECE — instead of silently rejecting the best players.
   */
  it("no baseline pool may exceed the invariant", () => {
    for (const piece of PLAYABLE_PIECES) {
      expect(EXERCISES[piece].length).toBeLessThanOrEqual(MAX_EXERCISES_PER_PIECE);
    }
  });

  it("leaves headroom for exercises added later through the content builder", () => {
    // The overlay appends to a piece's pool live, with no redeploy. The ceiling
    // must already cover pools the deployed baseline has never seen.
    for (const piece of PLAYABLE_PIECES) {
      expect(getMaxScoreForPiece(piece)).toBeLessThan(MAX_SUBMITTABLE_SCORE);
    }
  });
});
