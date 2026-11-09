import { describe, expect, it } from "vitest";
import {
  BASE_ASPECT,
  BASE_PAD,
  TILE_ASPECT,
  TILE_PADS,
  pathLayout,
} from "@/lib/exercises/path-layout";

const BASE_AR = BASE_ASPECT.h / BASE_ASPECT.w;
const TILE_AR = TILE_ASPECT.h / TILE_ASPECT.w;

describe("pathLayout — tiles above the base", () => {
  it("grows one tile per 2 nodes after the first (base) node", () => {
    expect(pathLayout(1).tilesAbove).toBe(0); // base only
    expect(pathLayout(2).tilesAbove).toBe(1);
    expect(pathLayout(3).tilesAbove).toBe(1);
    expect(pathLayout(4).tilesAbove).toBe(2);
    expect(pathLayout(11).tilesAbove).toBe(5);
    expect(pathLayout(15).tilesAbove).toBe(7);
  });
});

describe("pathLayout — node positions", () => {
  it("returns nothing for non-positive counts", () => {
    const l = pathLayout(0);
    expect(l.positions).toEqual([]);
    expect(l.baseFrac).toBe(1);
    expect(l.tilesAbove).toBe(0);
  });

  it("seats node 0 on the base pad", () => {
    const l = pathLayout(1);
    expect(l.positions).toHaveLength(1);
    // single node → whole canvas is the base, so the pad %coords pass through.
    expect(l.positions[0]).toEqual({ x: BASE_PAD.x, y: BASE_PAD.y });
    expect(l.tilesAbove).toBe(0);
  });

  it("keeps node 0 (base) at the visual bottom for any count", () => {
    for (const n of [1, 2, 3, 10, 15]) {
      const { positions } = pathLayout(n);
      const maxY = Math.max(...positions.map((p) => p.y));
      expect(positions[0].y).toBe(maxY);
      expect(positions[0].x).toBe(BASE_PAD.x);
    }
  });

  it("spreads nodes monotonically bottom → top", () => {
    const { positions } = pathLayout(10);
    expect(positions).toHaveLength(10);
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i].y).toBeLessThan(positions[i - 1].y);
    }
  });

  it("alternates tile-node x across the trail (zigzag)", () => {
    const { positions } = pathLayout(5);
    // nodes 1.. use the tile pads, alternating bottom/top pad x.
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i].x).toBe(TILE_PADS[(i - 1) % 2].x);
    }
  });

  it("stays within the canvas bounds", () => {
    for (const p of pathLayout(15).positions) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(100);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(100);
    }
  });

  it("sizes the base as a shrinking fraction as tiles are added", () => {
    expect(pathLayout(1).baseFrac).toBe(1);
    // 3 nodes → 1 tile above the base.
    const total3 = BASE_AR + TILE_AR;
    expect(pathLayout(3).totalUnits).toBeCloseTo(total3, 5);
    expect(pathLayout(3).baseFrac).toBeCloseTo(BASE_AR / total3, 5);
    // more tiles → smaller base fraction
    expect(pathLayout(11).baseFrac).toBeLessThan(pathLayout(3).baseFrac);
  });
});
