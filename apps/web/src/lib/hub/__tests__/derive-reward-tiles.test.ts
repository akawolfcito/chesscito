import { describe, it, expect, vi } from "vitest";

import {
  REWARD_TILE_ORDER,
  deriveRewardTiles,
} from "../derive-reward-tiles.js";

describe("deriveRewardTiles", () => {
  describe("ordering", () => {
    it("returns tiles in narrative unlock order", () => {
      const tiles = deriveRewardTiles({
        badgesClaimed: {},
        starsPerPiece: {},
      });

      expect(tiles.map((t) => t.id)).toEqual([...REWARD_TILE_ORDER]);
    });
  });

  describe("state derivation", () => {
    it("first piece with no progress is `progress` (gateway tier)", () => {
      const [first] = deriveRewardTiles({
        badgesClaimed: {},
        starsPerPiece: { rook: 0 },
      });

      expect(first.id).toBe("rook");
      expect(first.state).toBe("progress");
    });

    it("first piece becomes `claimable` once stars meet threshold", () => {
      const [first] = deriveRewardTiles({
        badgesClaimed: {},
        starsPerPiece: { rook: 10 },
      });

      expect(first.state).toBe("claimable");
    });

    it("custom threshold drives claimable boundary", () => {
      const tiles = deriveRewardTiles({
        badgesClaimed: {},
        starsPerPiece: { rook: 5 },
        threshold: 5,
      });

      expect(tiles[0].state).toBe("claimable");
    });

    it("subsequent piece is `locked` until prior tier is mastered", () => {
      const tiles = deriveRewardTiles({
        badgesClaimed: {},
        starsPerPiece: { rook: 4 },
      });

      const bishop = tiles.find((t) => t.id === "bishop");
      expect(bishop?.state).toBe("locked");
    });

    it("unlocks next tier as `progress` once prior tier is claimed on-chain", () => {
      const tiles = deriveRewardTiles({
        badgesClaimed: { rook: true },
        starsPerPiece: {},
      });

      // rook drops out (already minted); bishop is now the gateway tier.
      expect(tiles[0].id).toBe("bishop");
      expect(tiles[0].state).toBe("progress");
    });

    it("unlocks next tier as `progress` once prior tier meets threshold (badge not yet claimed)", () => {
      const tiles = deriveRewardTiles({
        badgesClaimed: {},
        starsPerPiece: { rook: 12 },
      });

      const bishop = tiles.find((t) => t.id === "bishop");
      expect(bishop?.state).toBe("progress");
    });
  });

  describe("claimed pieces", () => {
    it("drops claimed pieces from the column entirely", () => {
      const tiles = deriveRewardTiles({
        badgesClaimed: { rook: true, bishop: true },
        starsPerPiece: {},
      });

      const ids = tiles.map((t) => t.id);
      expect(ids).not.toContain("rook");
      expect(ids).not.toContain("bishop");
    });

    it("returns empty array when every piece is mastered", () => {
      const tiles = deriveRewardTiles({
        badgesClaimed: {
          rook: true,
          bishop: true,
          queen: true,
          knight: true,
          king: true,
          pawn: true,
        },
        starsPerPiece: {},
      });

      expect(tiles).toEqual([]);
    });
  });

  describe("tap handler propagation", () => {
    it("forwards onTileTap with the tile's piece id when invoked", () => {
      const onTileTap = vi.fn();

      const tiles = deriveRewardTiles({
        badgesClaimed: {},
        starsPerPiece: { rook: 10 },
        onTileTap,
      });

      const rook = tiles.find((t) => t.id === "rook");
      rook?.onTap?.();

      expect(onTileTap).toHaveBeenCalledExactlyOnceWith("rook");
    });

    it("omits onTap when no handler is provided", () => {
      const tiles = deriveRewardTiles({
        badgesClaimed: {},
        starsPerPiece: {},
      });

      expect(tiles[0].onTap).toBeUndefined();
    });
  });
});
