import { describe, expect, it } from "vitest";
import {
  TILE_PADS,
  tileCount,
  tileNodePositions,
} from "@/lib/exercises/path-layout";

describe("tileCount", () => {
  it("needs one tile for an empty or single-pad load", () => {
    expect(tileCount(0)).toBe(1);
    expect(tileCount(1)).toBe(1);
    expect(tileCount(2)).toBe(1);
  });

  it("adds a tile every `padsPerTile` nodes", () => {
    expect(tileCount(3)).toBe(2);
    expect(tileCount(4)).toBe(2);
    expect(tileCount(10)).toBe(5);
    expect(tileCount(15)).toBe(8);
    expect(tileCount(31)).toBe(16);
  });
});

describe("tileNodePositions", () => {
  it("returns [] for non-positive counts", () => {
    expect(tileNodePositions(0)).toEqual([]);
    expect(tileNodePositions(-2)).toEqual([]);
  });

  it("places the two pads of a single tile bottom→top", () => {
    const pts = tileNodePositions(2);
    expect(pts).toHaveLength(2);
    // node 0 = bottom pad, node 1 = top pad (single tile → tile %=canvas %).
    expect(pts[0]).toEqual({ x: TILE_PADS[0].x, y: TILE_PADS[0].y });
    expect(pts[1]).toEqual({ x: TILE_PADS[1].x, y: TILE_PADS[1].y });
  });

  it("keeps node 0 at the visual bottom regardless of total count", () => {
    for (const n of [2, 5, 10, 15]) {
      const pts = tileNodePositions(n);
      const maxY = Math.max(...pts.map((p) => p.y));
      expect(pts[0].y).toBe(maxY); // bottom = largest y
    }
  });

  it("spreads nodes monotonically bottom→top", () => {
    const pts = tileNodePositions(10);
    expect(pts).toHaveLength(10);
    for (let i = 1; i < pts.length; i++) {
      expect(pts[i].y).toBeLessThan(pts[i - 1].y);
    }
  });

  it("alternates pad x across the trail (zigzag)", () => {
    const pts = tileNodePositions(6);
    // even indices → bottom pad x, odd → top pad x
    for (let i = 0; i < pts.length; i++) {
      expect(pts[i].x).toBe(TILE_PADS[i % 2].x);
    }
  });

  it("maps each node onto a real pad (every y is a tile pad position)", () => {
    const tiles = tileCount(7);
    const pts = tileNodePositions(7);
    for (const p of pts) {
      // recover the within-tile y and assert it matches a known pad
      const within = ((p.y / 100) * tiles) % 1;
      const closeToPad = TILE_PADS.some(
        (pad) => Math.abs(within * 100 - pad.y) < 0.001,
      );
      expect(closeToPad).toBe(true);
    }
  });

  it("stays within the canvas bounds", () => {
    const pts = tileNodePositions(15);
    for (const p of pts) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(100);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(100);
    }
  });
});
