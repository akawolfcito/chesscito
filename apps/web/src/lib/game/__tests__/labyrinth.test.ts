import { describe, expect, it } from "vitest";
import type { BoardPosition, PieceId } from "@/lib/game/types";
import { getRookMoves } from "@/lib/game/rules/rook";
import { getBishopMoves } from "@/lib/game/rules/bishop";
import { getKnightMoves } from "@/lib/game/rules/knight";
import { getPawnMoves } from "@/lib/game/rules/pawn";
import { getQueenMoves } from "@/lib/game/rules/queen";
import { LABYRINTHS, labyrinthStars } from "@/lib/game/exercises";
import { getValidTargets } from "@/lib/game/board";

const pos = (file: number, rank: number) => ({ file, rank });

const PIECES_WITH_LABYRINTHS: PieceId[] = ["rook", "bishop", "knight", "pawn", "queen"];

function posKey(p: BoardPosition): string {
  return `${p.file},${p.rank}`;
}

/** BFS over knight moves, returns min depth or null if unreachable ≤ maxDepth. */
function bfsKnightDepth(
  start: BoardPosition,
  target: BoardPosition,
  maxDepth: number,
): number | null {
  if (start.file === target.file && start.rank === target.rank) return 0;
  let frontier = [start];
  const visited = new Set<string>([posKey(start)]);
  for (let depth = 1; depth <= maxDepth; depth++) {
    const next: BoardPosition[] = [];
    for (const sq of frontier) {
      for (const move of getKnightMoves(sq)) {
        if (move.file === target.file && move.rank === target.rank) return depth;
        const k = posKey(move);
        if (!visited.has(k)) {
          visited.add(k);
          next.push(move);
        }
      }
    }
    frontier = next;
  }
  return null;
}

/** BFS over pawn moves (with blockers & isCapture filtering),
 *  returns min depth or null if unreachable ≤ maxDepth. */
function bfsPawnDepth(
  start: BoardPosition,
  target: BoardPosition,
  blockers: BoardPosition[],
  isCapture: boolean,
  maxDepth: number,
): number | null {
  if (start.file === target.file && start.rank === target.rank) return 0;
  const blockerSet = new Set(blockers.map(posKey));
  let frontier = [start];
  const visited = new Set<string>([posKey(start)]);
  for (let depth = 1; depth <= maxDepth; depth++) {
    const next: BoardPosition[] = [];
    for (const sq of frontier) {
      const candidates = getPawnMoves(sq, blockers, isCapture);
      for (const move of candidates) {
        if (blockerSet.has(posKey(move))) continue;
        if (move.file === target.file && move.rank === target.rank) return depth;
        const k = posKey(move);
        if (!visited.has(k)) {
          visited.add(k);
          next.push(move);
        }
      }
    }
    frontier = next;
  }
  return null;
}

/** Generic BFS over sliding moves (rook, bishop, queen), returns min
 *  depth or null if unreachable ≤ maxDepth. */
function bfsSlidingDepth(
  start: BoardPosition,
  target: BoardPosition,
  blockers: BoardPosition[],
  getMoves: (pos: BoardPosition, blockers: BoardPosition[]) => BoardPosition[],
  maxDepth: number,
): number | null {
  if (start.file === target.file && start.rank === target.rank) return 0;
  let frontier = [start];
  const visited = new Set<string>([posKey(start)]);
  for (let depth = 1; depth <= maxDepth; depth++) {
    const next: BoardPosition[] = [];
    for (const sq of frontier) {
      for (const move of getMoves(sq, blockers)) {
        if (move.file === target.file && move.rank === target.rank) return depth;
        const k = posKey(move);
        if (!visited.has(k)) {
          visited.add(k);
          next.push(move);
        }
      }
    }
    frontier = next;
  }
  return null;
}

describe("L2 labyrinth — rook movement with obstacles", () => {
  it("rook stops one square before an obstacle in the same file", () => {
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
    const moves = getRookMoves(pos(0, 0), [pos(3, 0)]);
    const northRay = moves.filter((m) => m.file === 0).map((m) => m.rank);
    expect(northRay.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("multiple obstacles each block their own ray independently", () => {
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

describe("L2 labyrinth — seeded data integrity (all pieces)", () => {
  it.each(PIECES_WITH_LABYRINTHS)("%s has at least one labyrinth", (piece) => {
    expect(LABYRINTHS[piece].length).toBeGreaterThan(0);
  });

  it.each(PIECES_WITH_LABYRINTHS)(
    "%s: every labyrinth has startPos !== targetPos",
    (piece) => {
      for (const lab of LABYRINTHS[piece]) {
        expect(
          lab.startPos.file === lab.targetPos.file &&
          lab.startPos.rank === lab.targetPos.rank,
        ).toBe(false);
      }
    },
  );

  it.each(PIECES_WITH_LABYRINTHS)(
    "%s: every labyrinth has valid board positions",
    (piece) => {
      for (const lab of LABYRINTHS[piece]) {
        const all = [lab.startPos, lab.targetPos, ...(lab.obstacles ?? [])];
        for (const p of all) {
          expect(p.file).toBeGreaterThanOrEqual(0);
          expect(p.file).toBeLessThan(8);
          expect(p.rank).toBeGreaterThanOrEqual(0);
          expect(p.rank).toBeLessThan(8);
        }
      }
    },
  );

  it.each(PIECES_WITH_LABYRINTHS)(
    "%s: every labyrinth has optimalMoves > 0",
    (piece) => {
      for (const lab of LABYRINTHS[piece]) {
        expect(lab.optimalMoves).toBeGreaterThan(0);
      }
    },
  );

  it.each(PIECES_WITH_LABYRINTHS)(
    "%s: every labyrinth has optimalMoves >= 2",
    (piece) => {
      for (const lab of LABYRINTHS[piece]) {
        expect(lab.optimalMoves).toBeGreaterThanOrEqual(2);
      }
    },
  );

  it.each(PIECES_WITH_LABYRINTHS)(
    "%s: obstacles do not overlap startPos or targetPos",
    (piece) => {
      for (const lab of LABYRINTHS[piece]) {
        for (const obs of lab.obstacles ?? []) {
          expect(
            obs.file === lab.startPos.file && obs.rank === lab.startPos.rank,
          ).toBe(false);
          expect(
            obs.file === lab.targetPos.file && obs.rank === lab.targetPos.rank,
          ).toBe(false);
        }
      }
    },
  );

  it.each(PIECES_WITH_LABYRINTHS)(
    "%s: obstacles do not duplicate",
    (piece) => {
      for (const lab of LABYRINTHS[piece]) {
        const keys = (lab.obstacles ?? []).map((o) => posKey(o));
        expect(new Set(keys).size).toBe(keys.length);
      }
    },
  );
});

describe("L2 labyrinth — knight path existence", () => {
  const setups: { piece: PieceId; id: string; optimal: number }[] = [
    { piece: "knight", id: "knight-lab-1", optimal: 3 },
    { piece: "knight", id: "knight-lab-2", optimal: 4 },
    { piece: "knight", id: "knight-lab-3", optimal: 6 },
    { piece: "knight", id: "knight-lab-4", optimal: 4 },
    { piece: "knight", id: "knight-lab-5", optimal: 5 },
  ];

  it.each(setups)("$id: maximum depth to reach target is $optimal", ({ piece, id, optimal }) => {
    const lab = LABYRINTHS[piece].find((l) => l.id === id);
    expect(lab).toBeDefined();
    if (!lab) return;

    const minDepth = bfsKnightDepth(lab.startPos, lab.targetPos, optimal);
    expect(minDepth).toBe(optimal);
  });

  it.each(setups)(
    "$id: target is NOT reachable in fewer than $optimal moves",
    ({ piece, id, optimal }) => {
      const lab = LABYRINTHS[piece].find((l) => l.id === id);
      expect(lab).toBeDefined();
      if (!lab) return;

      if (optimal > 1) {
        const tooSoon = bfsKnightDepth(lab.startPos, lab.targetPos, optimal - 1);
        expect(tooSoon).toBeNull();
      }
    },
  );
});

describe("L2 labyrinth — pawn path existence", () => {
  const setups: { piece: PieceId; id: string; optimal: number }[] = [
    { piece: "pawn", id: "pawn-lab-3", optimal: 5 },
    { piece: "pawn", id: "pawn-lab-4", optimal: 4 },
    { piece: "pawn", id: "pawn-lab-5", optimal: 5 },
  ];

  it.each(setups)("$id: maximum depth to reach target is $optimal", ({ piece, id, optimal }) => {
    const lab = LABYRINTHS[piece].find((l) => l.id === id);
    expect(lab).toBeDefined();
    if (!lab) return;

    const minDepth = bfsPawnDepth(
      lab.startPos,
      lab.targetPos,
      lab.obstacles ?? [],
      lab.isCapture ?? false,
      optimal,
    );
    expect(minDepth).toBe(optimal);
  });

  it.each(setups)(
    "$id: target is NOT reachable in fewer than $optimal moves",
    ({ piece, id, optimal }) => {
      const lab = LABYRINTHS[piece].find((l) => l.id === id);
      expect(lab).toBeDefined();
      if (!lab) return;

      if (optimal > 1) {
        const tooSoon = bfsPawnDepth(
          lab.startPos,
          lab.targetPos,
          lab.obstacles ?? [],
          lab.isCapture ?? false,
          optimal - 1,
        );
        expect(tooSoon).toBeNull();
      }
    },
  );
});

describe("L2 labyrinth — queen path existence", () => {
  const setups: { piece: PieceId; id: string; optimal: number }[] = [
    { piece: "queen", id: "queen-lab-1", optimal: 3 },
    { piece: "queen", id: "queen-lab-2", optimal: 3 },
    { piece: "queen", id: "queen-lab-3", optimal: 3 },
  ];

  it.each(setups)("$id: maximum depth to reach target is $optimal", ({ piece, id, optimal }) => {
    const lab = LABYRINTHS[piece].find((l) => l.id === id);
    expect(lab).toBeDefined();
    if (!lab) return;

    const minDepth = bfsSlidingDepth(
      lab.startPos,
      lab.targetPos,
      lab.obstacles ?? [],
      getQueenMoves,
      optimal,
    );
    expect(minDepth).toBe(optimal);
  });

  it.each(setups)(
    "$id: target is NOT reachable in fewer than $optimal moves",
    ({ piece, id, optimal }) => {
      const lab = LABYRINTHS[piece].find((l) => l.id === id);
      expect(lab).toBeDefined();
      if (!lab) return;

      if (optimal > 1) {
        const tooSoon = bfsSlidingDepth(
          lab.startPos,
          lab.targetPos,
          lab.obstacles ?? [],
          getQueenMoves,
          optimal - 1,
        );
        expect(tooSoon).toBeNull();
      }
    },
  );
});

describe("L2 labyrinth — rook path existence", () => {
  const setups: { piece: PieceId; id: string; optimal: number }[] = [
    { piece: "rook", id: "rook-lab-1", optimal: 3 },
    { piece: "rook", id: "rook-lab-2", optimal: 3 },
    { piece: "rook", id: "rook-lab-3", optimal: 3 },
  ];

  it.each(setups)("$id: maximum depth to reach target is $optimal", ({ piece, id, optimal }) => {
    const lab = LABYRINTHS[piece].find((l) => l.id === id);
    expect(lab).toBeDefined();
    if (!lab) return;

    const minDepth = bfsSlidingDepth(
      lab.startPos,
      lab.targetPos,
      lab.obstacles ?? [],
      getRookMoves,
      optimal,
    );
    expect(minDepth).toBe(optimal);
  });

  it.each(setups)(
    "$id: target is NOT reachable in fewer than $optimal moves",
    ({ piece, id, optimal }) => {
      const lab = LABYRINTHS[piece].find((l) => l.id === id);
      expect(lab).toBeDefined();
      if (!lab) return;

      if (optimal > 1) {
        const tooSoon = bfsSlidingDepth(
          lab.startPos,
          lab.targetPos,
          lab.obstacles ?? [],
          getRookMoves,
          optimal - 1,
        );
        expect(tooSoon).toBeNull();
      }
    },
  );
});

describe("L2 labyrinth — bishop path existence", () => {
  const setups: { piece: PieceId; id: string; optimal: number }[] = [
    { piece: "bishop", id: "bishop-lab-3", optimal: 3 },
    { piece: "bishop", id: "bishop-lab-4", optimal: 5 },
  ];

  it.each(setups)("$id: maximum depth to reach target is $optimal", ({ piece, id, optimal }) => {
    const lab = LABYRINTHS[piece].find((l) => l.id === id);
    expect(lab).toBeDefined();
    if (!lab) return;

    const minDepth = bfsSlidingDepth(
      lab.startPos,
      lab.targetPos,
      lab.obstacles ?? [],
      getBishopMoves,
      optimal,
    );
    expect(minDepth).toBe(optimal);
  });

  it.each(setups)(
    "$id: target is NOT reachable in fewer than $optimal moves",
    ({ piece, id, optimal }) => {
      const lab = LABYRINTHS[piece].find((l) => l.id === id);
      expect(lab).toBeDefined();
      if (!lab) return;

      if (optimal > 1) {
        const tooSoon = bfsSlidingDepth(
          lab.startPos,
          lab.targetPos,
          lab.obstacles ?? [],
          getBishopMoves,
          optimal - 1,
        );
        expect(tooSoon).toBeNull();
      }
    },
  );
});

describe("L2 labyrinth — rook-lab-1 legacy data integrity", () => {
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
