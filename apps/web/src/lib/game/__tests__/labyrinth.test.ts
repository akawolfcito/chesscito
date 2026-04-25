import { describe, expect, it } from "vitest";
import { getRookMoves } from "@/lib/game/rules/rook";
import { LABYRINTHS, labyrinthStars } from "@/lib/game/exercises";
import { getValidTargets } from "@/lib/game/board";

const pos = (file: number, rank: number) => ({ file, rank });

describe("L2 labyrinth — rook movement with obstacles", () => {
  it("rook stops one square before an obstacle in the same file", () => {
    // Rook at a1; obstacle at d1 (file 3). Moves along rank 0 should
    // include b1 and c1 but stop before d1.
    const moves = getRookMoves(pos(0, 0), [pos(3, 0)]);
    const sameRank = moves.filter((m) => m.rank === 0);
    expect(sameRank.map((m) => m.file).sort((a, b) => a - b)).toEqual([1, 2]);
  });

  it("rook does not include the obstacle square in valid targets", () => {
    const obstacle = pos(3, 0);
    const moves = getRookMoves(pos(0, 0), [obstacle]);
    const containsObstacle = moves.some(
      (m) => m.file === obstacle.file && m.rank === obstacle.rank,
    );
    expect(containsObstacle).toBe(false);
  });

  it("rook can move freely on rays not blocked by obstacles", () => {
    // Obstacle at d1 only blocks the east ray. The north ray (file a)
    // should be fully traversable up to a8.
    const moves = getRookMoves(pos(0, 0), [pos(3, 0)]);
    const northRay = moves.filter((m) => m.file === 0).map((m) => m.rank);
    expect(northRay.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("multiple obstacles each block their own ray independently", () => {
    // Rook at d4 (3,3). Obstacles at d6 (3,5), f4 (5,3), b4 (1,3).
    // Expected: north ray ends at d5; east ray ends at e4; west ray
    // ends at c4; south ray fully traversable.
    const moves = getRookMoves(pos(3, 3), [pos(3, 5), pos(5, 3), pos(1, 3)]);
    const north = moves.filter((m) => m.file === 3 && m.rank > 3).map((m) => m.rank);
    const east  = moves.filter((m) => m.rank === 3 && m.file > 3).map((m) => m.file);
    const west  = moves.filter((m) => m.rank === 3 && m.file < 3).map((m) => m.file);
    const south = moves.filter((m) => m.file === 3 && m.rank < 3).map((m) => m.rank);
    expect(north.sort((a, b) => a - b)).toEqual([4]);
    expect(east.sort((a, b) => a - b)).toEqual([4]);
    expect(west.sort((a, b) => a - b)).toEqual([2]);
    expect(south.sort((a, b) => a - b)).toEqual([0, 1, 2]);
  });

  it("getValidTargets routes obstacles through to rook rules", () => {
    const targets = getValidTargets("rook", pos(0, 0), [pos(3, 0)], false);
    const blocked = targets.some((t) => t.file === 3 && t.rank === 0);
    expect(blocked).toBe(false);
    expect(targets.length).toBeGreaterThan(0);
  });
});

describe("L2 labyrinth — star threshold helper", () => {
  it("3 stars when moves equals optimal", () => {
    expect(labyrinthStars(4, 4)).toBe(3);
  });

  it("3 stars when moves are below optimal (defensive — should not happen)", () => {
    expect(labyrinthStars(3, 4)).toBe(3);
  });

  it("2 stars when moves are within optimal+2", () => {
    expect(labyrinthStars(5, 4)).toBe(2);
    expect(labyrinthStars(6, 4)).toBe(2);
  });

  it("1 star when moves are within optimal+4 but past +2", () => {
    expect(labyrinthStars(7, 4)).toBe(1);
    expect(labyrinthStars(8, 4)).toBe(1);
  });

  it("0 stars when moves exceed optimal+4", () => {
    expect(labyrinthStars(9, 4)).toBe(0);
    expect(labyrinthStars(20, 4)).toBe(0);
  });
});

describe("L2 labyrinth — seeded data integrity", () => {
  it("rook-lab-1 has at least one obstacle and a positive optimal", () => {
    const [first] = LABYRINTHS.rook;
    expect(first).toBeDefined();
    expect(first.obstacles?.length ?? 0).toBeGreaterThan(0);
    expect(first.optimalMoves).toBeGreaterThan(0);
  });

  it("rook-lab-1 obstacles are all inside the 8x8 board", () => {
    const [first] = LABYRINTHS.rook;
    for (const obstacle of first.obstacles ?? []) {
      expect(obstacle.file).toBeGreaterThanOrEqual(0);
      expect(obstacle.file).toBeLessThan(8);
      expect(obstacle.rank).toBeGreaterThanOrEqual(0);
      expect(obstacle.rank).toBeLessThan(8);
    }
  });

  it("rook-lab-1 start and target are not on an obstacle", () => {
    const [first] = LABYRINTHS.rook;
    const onObstacle = (p: { file: number; rank: number }) =>
      first.obstacles?.some((o) => o.file === p.file && o.rank === p.rank) ?? false;
    expect(onObstacle(first.startPos)).toBe(false);
    expect(onObstacle(first.targetPos)).toBe(false);
  });
});
