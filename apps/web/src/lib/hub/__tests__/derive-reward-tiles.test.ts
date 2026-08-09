import { describe, it, expect, vi } from "vitest";

import {
  REWARD_TILE_ORDER,
  deriveRewardTiles,
} from "../derive-reward-tiles.js";
import { EXERCISES, badgeRequiredCount } from "@/lib/game/exercises";

// The badge gate is COMPLETION, not stars: 80% of the pool, rounded up.
// Rook ships 10 exercises → 8 completions earn the badge.

/** State-only cases: the visible counter is not under test, so they declare
 *  themselves unhydrated — the honest shape for "no stars supplied". Spelled
 *  out rather than defaulted in the type, so a caller that DOES want a counter
 *  cannot forget the stars and quietly render 0/N. */
const stateOnly = { starsByIdPerPiece: {}, isHydrated: false } as const;

describe("deriveRewardTiles", () => {
  describe("ordering", () => {
    it("returns tiles in narrative unlock order", () => {
      const tiles = deriveRewardTiles({
        ...stateOnly,
        badgesClaimed: {},
        completedPerPiece: {},
      });

      expect(tiles.map((t) => t.id)).toEqual([...REWARD_TILE_ORDER]);
    });
  });

  describe("state derivation", () => {
    it("first piece with no progress is `progress` (gateway tier)", () => {
      const [first] = deriveRewardTiles({
        ...stateOnly,
        badgesClaimed: {},
        completedPerPiece: { rook: 0 },
      });

      expect(first.id).toBe("rook");
      expect(first.state).toBe("progress");
    });

    it("first piece becomes `claimable` once 80% of exercises are completed", () => {
      const [first] = deriveRewardTiles({
        ...stateOnly,
        badgesClaimed: {},
        completedPerPiece: { rook: 8 },
      });

      expect(first.state).toBe("claimable");
    });

    it("stays `progress` one completion short of the 80% gate", () => {
      const tiles = deriveRewardTiles({
        ...stateOnly,
        badgesClaimed: {},
        completedPerPiece: { rook: 7 },
      });

      expect(tiles[0].state).toBe("progress");
    });

    it("subsequent piece is `locked` until prior tier is mastered", () => {
      const tiles = deriveRewardTiles({
        ...stateOnly,
        badgesClaimed: {},
        completedPerPiece: { rook: 4 },
      });

      const bishop = tiles.find((t) => t.id === "bishop");
      expect(bishop?.state).toBe("locked");
    });

    it("unlocks next tier as `progress` once prior tier is claimed on-chain", () => {
      const tiles = deriveRewardTiles({
        ...stateOnly,
        badgesClaimed: { rook: true },
        completedPerPiece: {},
      });

      expect(tiles[0]).toMatchObject({ id: "rook", state: "claimed" });
      expect(tiles[1]).toMatchObject({ id: "bishop", state: "progress" });
    });

    it("unlocks next tier as `progress` once prior tier earns the badge (not yet claimed)", () => {
      const tiles = deriveRewardTiles({
        ...stateOnly,
        badgesClaimed: {},
        completedPerPiece: { rook: 10 },
      });

      const bishop = tiles.find((t) => t.id === "bishop");
      expect(bishop?.state).toBe("progress");
    });
  });

  describe("claimed pieces", () => {
    it("keeps claimed pieces visible so the Hub always shows the full sequence", () => {
      const tiles = deriveRewardTiles({
        ...stateOnly,
        badgesClaimed: { rook: true, bishop: true },
        completedPerPiece: {},
      });

      const ids = tiles.map((t) => t.id);
      expect(ids).toEqual([...REWARD_TILE_ORDER]);
      expect(tiles[0]).toMatchObject({ id: "rook", state: "claimed" });
      expect(tiles[1]).toMatchObject({ id: "bishop", state: "claimed" });
    });

    it("returns the full visual sequence when every piece is mastered", () => {
      const tiles = deriveRewardTiles({
        ...stateOnly,
        badgesClaimed: {
          rook: true,
          bishop: true,
          queen: true,
          knight: true,
          king: true,
          pawn: true,
        },
        completedPerPiece: {},
      });

      expect(tiles.map((t) => t.id)).toEqual([...REWARD_TILE_ORDER]);
      expect(tiles.every((t) => t.state === "claimed")).toBe(true);
    });
  });

  describe("tap handler propagation", () => {
    it("forwards onTileTap with the tile's piece id when invoked", () => {
      const onTileTap = vi.fn();

      const tiles = deriveRewardTiles({
        ...stateOnly,
        badgesClaimed: {},
        completedPerPiece: { rook: 8 },
        onTileTap,
      });

      const rook = tiles.find((t) => t.id === "rook");
      rook?.onTap?.();

      expect(onTileTap).toHaveBeenCalledExactlyOnceWith("rook");
    });

    it("omits onTap when no handler is provided", () => {
      const tiles = deriveRewardTiles({
        ...stateOnly,
        badgesClaimed: {},
        completedPerPiece: {},
      });

      expect(tiles[0].onTap).toBeUndefined();
    });
  });

  // Paso 2 — docs/specs/2026-08-09-hub-tile-progress-counter.md
  describe("visible counter", () => {
    /** Ids come from the catalog, never hand-written: exercise ids are not
     *  sequential, and pinning authored content makes the test lie the day
     *  the builder changes it. */
    const starsForFirst = (piece: "rook", howMany: number) =>
      Object.fromEntries(
        EXERCISES[piece].slice(0, howMany).map((ex) => [ex.id, 1]),
      );

    it("counts the progress tile over the live catalog, against the GATE", () => {
      const [rook] = deriveRewardTiles({
        badgesClaimed: {},
        completedPerPiece: { rook: 3 },
        starsByIdPerPiece: { rook: starsForFirst("rook", 3) },
        isHydrated: true,
      });

      expect(rook.state).toBe("progress");
      expect(rook.progress).toEqual({
        completed: 3,
        // The gate (80% rounded up), not the pool size — "8/10" with the
        // badge already earned is a number nobody can reconcile.
        required: badgeRequiredCount(EXERCISES.rook.length),
      });
    });

    /** Regression guard, not a driver: this already holds because the counter
     *  goes through `completedExerciseCount`. It exists so a future refactor
     *  to a naive "count the positive entries" breaks HERE instead of in the
     *  player's face, as "4/8 on the tile, 3 done in the drawer". */
    it("leaves retired ids out of the counter while the GATE still counts them", () => {
      const [rook] = deriveRewardTiles({
        badgesClaimed: {},
        // The wide count the gate reads — 4, retired id included.
        completedPerPiece: { rook: 4 },
        starsByIdPerPiece: {
          rook: {
            ...starsForFirst("rook", 3),
            "rook-retired-from-an-older-pool": 3,
          },
        },
        isHydrated: true,
      });

      // The chip shows what the drawer lets the player count: 3.
      expect(rook.progress?.completed).toBe(3);
    });

    it("says nothing before hydration — no tile carries a counter", () => {
      const tiles = deriveRewardTiles({
        badgesClaimed: {},
        completedPerPiece: { rook: 3 },
        starsByIdPerPiece: { rook: starsForFirst("rook", 3) },
        isHydrated: false,
      });

      expect(tiles.every((tile) => tile.progress === undefined)).toBe(true);
    });

    it("carries a counter only on the progress tile, never on the other three", () => {
      const tiles = deriveRewardTiles({
        badgesClaimed: { rook: true },
        completedPerPiece: { rook: 10, bishop: 3 },
        starsByIdPerPiece: {
          rook: starsForFirst("rook", 10),
          bishop: {},
        },
        isHydrated: true,
      });

      for (const tile of tiles) {
        if (tile.state === "progress") {
          expect(tile.progress).toBeDefined();
        } else {
          expect(tile.progress).toBeUndefined();
        }
      }
      // The fixture is only meaningful if it actually produced the states.
      expect(tiles.map((t) => t.state)).toContain("claimed");
      expect(tiles.map((t) => t.state)).toContain("progress");
      expect(tiles.map((t) => t.state)).toContain("locked");
    });
  });
});
