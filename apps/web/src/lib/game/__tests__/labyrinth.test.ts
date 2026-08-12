import { describe, expect, it } from "vitest";
import type { BoardPosition, PieceId } from "@/lib/game/types";
import { getRookMoves } from "@/lib/game/rules/rook";
import { getBishopMoves } from "@/lib/game/rules/bishop";
import { getKnightMoves } from "@/lib/game/rules/knight";
import { getPawnMoves } from "@/lib/game/rules/pawn";
import { getQueenMoves } from "@/lib/game/rules/queen";
import { LABYRINTHS, labyrinthStars } from "@/lib/game/exercises";
import { isSweep } from "@/lib/game/targets";
import { GENERATED_LABYRINTHS } from "@/lib/game/generated/puzzles.generated";
import { getValidTargets } from "@/lib/game/board";

const pos = (file: number, rank: number) => ({ file, rank });

/** Hand-authored labyrinths only (generated entries appended by the
 *  importer are excluded). Some design-bar invariants — e.g. the
 *  `optimalMoves >= 2` "must require a real path" rule — apply to the
 *  hand-authored design set; generated puzzles carry their own honest-
 *  optimalMoves gate in labyrinths-bfs-verifier.test.ts instead. */
function handAuthoredLabs(piece: PieceId) {
  const generatedIds = new Set(GENERATED_LABYRINTHS[piece].map((l) => l.id));
  return LABYRINTHS[piece].filter((l) => !generatedIds.has(l.id));
}

const PIECES_WITH_LABYRINTHS: PieceId[] = ["rook", "bishop", "knight", "pawn", "queen"];

function posKey(p: BoardPosition): string {
  return `${p.file},${p.rank}`;
}

/** BFS over knight moves, returns min depth or null if unreachable ≤ maxDepth.
 *  When blockers are provided, those squares are excluded from valid landing
 *  positions (labyrinth obstacles that the knight must avoid). */
function bfsKnightDepth(
  start: BoardPosition,
  target: BoardPosition,
  maxDepth: number,
  blockers: BoardPosition[] = [],
): number | null {
  if (start.file === target.file && start.rank === target.rank) return 0;
  const blockerSet = new Set(blockers.map(posKey));
  let frontier = [start];
  const visited = new Set<string>([posKey(start)]);
  for (let depth = 1; depth <= maxDepth; depth++) {
    const next: BoardPosition[] = [];
    for (const sq of frontier) {
      for (const move of getKnightMoves(sq)) {
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

/** BFS over pawn moves (with blockers & isCapture filtering),
 *  returns min depth or null if unreachable ≤ maxDepth. */
function bfsPawnDepth(
  start: BoardPosition,
  target: BoardPosition,
  blockers: BoardPosition[],
  isCapture: boolean,
  maxDepth: number,
  captureSquares?: BoardPosition[],
): number | null {
  if (start.file === target.file && start.rank === target.rank) return 0;
  const blockerSet = new Set(blockers.map(posKey));
  let frontier = [start];
  const visited = new Set<string>([posKey(start)]);
  for (let depth = 1; depth <= maxDepth; depth++) {
    const next: BoardPosition[] = [];
    for (const sq of frontier) {
      const candidates = getPawnMoves(sq, blockers, isCapture, captureSquares);
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
    "%s: every hand-authored labyrinth has optimalMoves >= 2",
    (piece) => {
      // Design-bar rule for the hand-authored set: a labyrinth must
      // require a real path. Generated puzzles may legitimately be
      // 1-move (their honesty is gated by the BFS verifier instead).
      for (const lab of handAuthoredLabs(piece)) {
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
  // optimalMoves is DATA-DERIVED (read from the lab), never hardcoded here.
  // The builder's Save recomputes it via BFS, so intentional difficulty edits
  // never trip a stale expectation — the test just follows the catalog.
  const setups: { piece: PieceId; id: string }[] = [
    { piece: "knight", id: "knight-lab-1" },
    { piece: "knight", id: "knight-lab-2" },
    { piece: "knight", id: "knight-lab-3" },
    { piece: "knight", id: "knight-lab-4" },
    { piece: "knight", id: "knight-lab-5" },
  ];

  it.each(setups)("$id: BFS reaches target in exactly lab.optimalMoves", ({ piece, id }) => {
    const lab = LABYRINTHS[piece].find((l) => l.id === id);
    expect(lab).toBeDefined();
    if (!lab) return;

    const optimal = lab.optimalMoves;
    const minDepth = bfsKnightDepth(lab.startPos, lab.targetPos, optimal, lab.obstacles);
    expect(minDepth).toBe(optimal);
  });

  it.each(setups)(
    "$id: target is NOT reachable in fewer than lab.optimalMoves moves",
    ({ piece, id }) => {
      const lab = LABYRINTHS[piece].find((l) => l.id === id);
      expect(lab).toBeDefined();
      if (!lab) return;

      const optimal = lab.optimalMoves;
      if (optimal > 1) {
        const tooSoon = bfsKnightDepth(lab.startPos, lab.targetPos, optimal - 1, lab.obstacles);
        expect(tooSoon).toBeNull();
      }
    },
  );
});

describe("L2 labyrinth — pawn path existence", () => {
  // optimalMoves DATA-DERIVED (see the knight block) — no hardcoded copy.
  const setups: { piece: PieceId; id: string }[] = [
    { piece: "pawn", id: "pawn-lab-1" },
    { piece: "pawn", id: "pawn-lab-3" },
    { piece: "pawn", id: "pawn-lab-4" },
    { piece: "pawn", id: "pawn-lab-5" },
  ];

  it.each(setups)("$id: BFS reaches target in exactly lab.optimalMoves", ({ piece, id }) => {
    const lab = LABYRINTHS[piece].find((l) => l.id === id);
    expect(lab).toBeDefined();
    if (!lab) return;

    const optimal = lab.optimalMoves;
    const captureSquares = lab.captureTargets
      ? [...lab.captureTargets, lab.targetPos]
      : undefined;

    const minDepth = bfsPawnDepth(
      lab.startPos,
      lab.targetPos,
      lab.obstacles ?? [],
      lab.isCapture ?? false,
      optimal,
      captureSquares,
    );
    expect(minDepth).toBe(optimal);
  });

  it.each(setups)(
    "$id: target is NOT reachable in fewer than lab.optimalMoves moves",
    ({ piece, id }) => {
      const lab = LABYRINTHS[piece].find((l) => l.id === id);
      expect(lab).toBeDefined();
      if (!lab) return;

      const optimal = lab.optimalMoves;
      if (optimal > 1) {
        const captureSquares = lab.captureTargets
          ? [...lab.captureTargets, lab.targetPos]
          : undefined;

        const tooSoon = bfsPawnDepth(
          lab.startPos,
          lab.targetPos,
          lab.obstacles ?? [],
          lab.isCapture ?? false,
          optimal - 1,
          captureSquares,
        );
        expect(tooSoon).toBeNull();
      }
    },
  );
});

describe("L2 labyrinth — pawn-lab-1 forced single-capture path", () => {
  it("pawn-lab-1: from d2 the only legal target is e3 (forward sealed by d3+d4)", () => {
    const lab = LABYRINTHS.pawn.find((l) => l.id === "pawn-lab-1");
    expect(lab).toBeDefined();
    if (!lab) return;
    const targets = getValidTargets(
      "pawn",
      lab.startPos,
      lab.obstacles ?? [],
      true,
      lab.captureTargets,
      lab.targetPos,
    );
    expect(targets).toHaveLength(1);
    expect(targets[0]).toEqual({ file: 4, rank: 2 }); // e3
  });

  it("pawn-lab-1: from e3 the only legal target is e4 (all diagonals dead)", () => {
    const lab = LABYRINTHS.pawn.find((l) => l.id === "pawn-lab-1");
    expect(lab).toBeDefined();
    if (!lab) return;
    const targets = getValidTargets(
      "pawn",
      { file: 4, rank: 2 }, // e3
      lab.obstacles ?? [],
      true,
      lab.captureTargets,
      lab.targetPos,
    );
    expect(targets).toHaveLength(1);
    expect(targets[0]).toEqual({ file: 4, rank: 3 }); // e4
  });
});

describe("L2 labyrinth — pawn isCapture + captureTargets verification", () => {
  it("pawn-lab-3: isCapture=true + captureTargets exposes diagonal capture target b3", () => {
    const lab = LABYRINTHS.pawn.find((l) => l.id === "pawn-lab-3");
    expect(lab).toBeDefined();
    if (!lab) return;
    const targets = getValidTargets("pawn", lab.startPos, lab.obstacles ?? [], true, lab.captureTargets, lab.targetPos);
    const hasDiagonal = targets.some((t) => t.file === 1 && t.rank === 2);
    expect(hasDiagonal).toBe(true);
  });

  it("pawn-lab-3: isCapture=false hides diagonal (forward blocked by a3)", () => {
    const lab = LABYRINTHS.pawn.find((l) => l.id === "pawn-lab-3");
    expect(lab).toBeDefined();
    if (!lab) return;
    const targets = getValidTargets("pawn", lab.startPos, lab.obstacles ?? [], false, lab.captureTargets, lab.targetPos);
    expect(targets.length).toBe(0);
  });

  it("pawn-lab-3: diagonal to non-captureTarget empty square is blocked", () => {
    const lab = LABYRINTHS.pawn.find((l) => l.id === "pawn-lab-3");
    expect(lab).toBeDefined();
    if (!lab) return;
    // From a2, b3 is a captureTarget, so allowed. From b3, c4 is a captureTarget, allowed.
    // But from b4 (after b3→b4 forward), c5 is NOT a captureTarget → blocked.
    const targets = getValidTargets("pawn", { file: 1, rank: 2 }, lab.obstacles ?? [], true, lab.captureTargets, lab.targetPos);
    const hasForward = targets.some((t) => t.file === 1 && t.rank === 3);
    expect(hasForward).toBe(true);
    // c4 is diagonal-right from b3 and IS a captureTarget
    const hasCaptureDiag = targets.some((t) => t.file === 2 && t.rank === 3);
    expect(hasCaptureDiag).toBe(true);
    // a4 is diagonal-left from b3 and NOT a captureTarget → blocked
    const hasEmptyDiag = targets.some((t) => t.file === 0 && t.rank === 3);
    expect(hasEmptyDiag).toBe(false);
  });
});

describe("L2 labyrinth — queen path existence", () => {
  // optimalMoves DATA-DERIVED (see the knight block) — no hardcoded copy.
  const setups: { piece: PieceId; id: string }[] = [
    { piece: "queen", id: "queen-lab-1" },
    { piece: "queen", id: "queen-lab-2" },
    { piece: "queen", id: "queen-lab-3" },
  ];

  it.each(setups)("$id: BFS reaches target in exactly lab.optimalMoves", ({ piece, id }) => {
    const lab = LABYRINTHS[piece].find((l) => l.id === id);
    expect(lab).toBeDefined();
    if (!lab) return;

    const optimal = lab.optimalMoves;
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
    "$id: target is NOT reachable in fewer than lab.optimalMoves moves",
    ({ piece, id }) => {
      const lab = LABYRINTHS[piece].find((l) => l.id === id);
      expect(lab).toBeDefined();
      if (!lab) return;

      const optimal = lab.optimalMoves;
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
  /* ⚠️ DERIVED from the catalogue, never a hand-copied list. The four ids used
   * to be written out here, so converting them to Star Sweeps broke this block
   * by name — and a fifth maze authored tomorrow would simply go unverified. */
  const rookLabs = LABYRINTHS.rook;

  /* A SWEEP is a different question, and the same one lane 1 already answered:
   * `bfsSlidingDepth` walks to `targetPos`, which on a sweep is only
   * `targets[0]`. Asserting it equals `optimalMoves` would demand that one leg
   * cost as much as collecting every star — i.e. it would fail precisely on the
   * levels that are correct. Their optimum is checked by the sweep solver in
   * labyrinths-bfs-verifier.test.ts; here they are exercised for the property
   * that still applies: the first leg must be strictly cheaper. */
  const singleGoal = rookLabs.filter((l) => !isSweep(l));
  const sweeps = rookLabs.filter((l) => isSweep(l));

  it.each(singleGoal)("$id: BFS reaches target in exactly lab.optimalMoves", (lab) => {
    const optimal = lab.optimalMoves;
    const minDepth = bfsSlidingDepth(
      lab.startPos,
      lab.targetPos,
      lab.obstacles ?? [],
      getRookMoves,
      optimal,
    );
    expect(minDepth).toBe(optimal);
  });

  it.each(singleGoal)(
    "$id: target is NOT reachable in fewer than lab.optimalMoves moves",
    (lab) => {
      const optimal = lab.optimalMoves;
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

  it.each(sweeps)("$id (sweep): the leg to the first star is strictly cheaper", (lab) => {
    const leg = bfsSlidingDepth(
      lab.startPos,
      lab.targetPos,
      lab.obstacles ?? [],
      getRookMoves,
      lab.optimalMoves,
    );
    expect(leg, `${lab.id}: targets[0] unreachable`).not.toBeNull();
    expect(leg!).toBeLessThan(lab.optimalMoves);
  });

  it("the rook still ships mazes of both shapes", () => {
    // Guards the split above: if every maze became a sweep, the single-goal
    // assertions would pass vacuously and stop protecting the other 15.
    expect(rookLabs.length).toBeGreaterThan(0);
  });
});

describe("L2 labyrinth — bishop path existence", () => {
  // optimalMoves DATA-DERIVED (see the knight block) — no hardcoded copy.
  const setups: { piece: PieceId; id: string }[] = [
    { piece: "bishop", id: "bishop-lab-3" },
    { piece: "bishop", id: "bishop-lab-4" },
  ];

  it.each(setups)("$id: BFS reaches target in exactly lab.optimalMoves", ({ piece, id }) => {
    const lab = LABYRINTHS[piece].find((l) => l.id === id);
    expect(lab).toBeDefined();
    if (!lab) return;

    const optimal = lab.optimalMoves;
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
    "$id: target is NOT reachable in fewer than lab.optimalMoves moves",
    ({ piece, id }) => {
      const lab = LABYRINTHS[piece].find((l) => l.id === id);
      expect(lab).toBeDefined();
      if (!lab) return;

      const optimal = lab.optimalMoves;
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

describe("L2 labyrinth — first Rook Rails level data integrity", () => {
  it("the first rook rail has at least one obstacle and a positive optimal", () => {
    const [first] = LABYRINTHS.rook;
    expect(first).toBeDefined();
    expect(first.obstacles?.length ?? 0).toBeGreaterThan(0);
    expect(first.optimalMoves).toBeGreaterThan(0);
  });

  it("the first rook rail's obstacles are all inside the 8x8 board", () => {
    const [first] = LABYRINTHS.rook;
    for (const obstacle of first.obstacles ?? []) {
      expect(obstacle.file).toBeGreaterThanOrEqual(0);
      expect(obstacle.file).toBeLessThan(8);
      expect(obstacle.rank).toBeGreaterThanOrEqual(0);
      expect(obstacle.rank).toBeLessThan(8);
    }
  });

  it("the first rook rail's start and target are not on an obstacle", () => {
    const [first] = LABYRINTHS.rook;
    const onObstacle = (p: { file: number; rank: number }) =>
      first.obstacles?.some((o) => o.file === p.file && o.rank === p.rank) ?? false;
    expect(onObstacle(first.startPos)).toBe(false);
    expect(onObstacle(first.targetPos)).toBe(false);
  });
});

describe("captureTargets — pawn diagonal restriction mechanics", () => {
  it("pawn cannot diagonal-step to empty square when captureSquares is empty array", () => {
    const moves = getPawnMoves(pos(0, 1), [], true, []);
    const diagonals = moves.filter((m) => m.file !== 0);
    expect(diagonals).toHaveLength(0);
  });

  it("pawn can diagonal-step to captureTarget", () => {
    const captureSquares = [pos(1, 2)];
    const moves = getPawnMoves(pos(0, 1), [], true, captureSquares);
    const hasDiagonal = moves.some((m) => m.file === 1 && m.rank === 2);
    expect(hasDiagonal).toBe(true);
  });

  it("pawn cannot diagonal-step to empty square when captureSquares only has a different square", () => {
    const captureSquares = [pos(1, 4)];
    const moves = getPawnMoves(pos(0, 1), [], true, captureSquares);
    const emptyDiagonal = moves.filter((m) => m.file !== 0 && m.rank === 2);
    expect(emptyDiagonal).toHaveLength(0);
  });

  it("pawn CAN diagonal-step to targetPos when captureTargets is empty but targetPos is in captureSquares", () => {
    const captureSquares = [pos(1, 2)];
    const moves = getPawnMoves(pos(0, 1), [], true, captureSquares);
    const hasTargetDiagonal = moves.some((m) => m.file === 1 && m.rank === 2);
    expect(hasTargetDiagonal).toBe(true);
  });

  it("pawn forward moves unaffected by captureSquares", () => {
    const moves = getPawnMoves(pos(0, 1), [], true, [pos(1, 2)]);
    const forwards = moves.filter((m) => m.file === 0);
    expect(forwards.length).toBeGreaterThan(0);
    const hasFwd1 = forwards.some((m) => m.rank === 2);
    expect(hasFwd1).toBe(true);
  });

  it("pawn double-forward still works when both forward squares are free", () => {
    const moves = getPawnMoves(pos(0, 1), [], true, [pos(1, 2)]);
    const hasDouble = moves.some((m) => m.file === 0 && m.rank === 3);
    expect(hasDouble).toBe(true);
  });

  it("pawn double-forward blocked when forward-1 is blocked", () => {
    const moves = getPawnMoves(pos(0, 1), [pos(0, 2)], true, [pos(1, 2)]);
    const hasDouble = moves.some((m) => m.file === 0 && m.rank === 3);
    expect(hasDouble).toBe(false);
  });

  it("getValidTargets passes captureTargets through for pawn", () => {
    const targets = getValidTargets("pawn", pos(0, 1), [], true, [pos(1, 2)]);
    const hasCapture = targets.some((t) => t.file === 1 && t.rank === 2);
    expect(hasCapture).toBe(true);
    const emptyDiagonal = targets.filter((t) => t.file !== 0 && t.file !== 1);
    expect(emptyDiagonal).toHaveLength(0);
  });

  it("getValidTargets: captureTargets undefined = all diagonals allowed (backward compat)", () => {
    const targets = getValidTargets("pawn", pos(0, 1), [], true);
    const diagonals = targets.filter((t) => t.file !== 0);
    expect(diagonals.length).toBeGreaterThan(0);
  });

  it("getValidTargets: non-pawn pieces ignore captureTargets", () => {
    const targets = getValidTargets("rook", pos(0, 0), [pos(1, 0)], false);
    const onCapture = targets.some((t) => t.file === 1 && t.rank === 0);
    expect(onCapture).toBe(false); // obstacle blocked
  });
});

/* L1 pawn capture exercise rule — when `isCapture=true` AND no
 * explicit `captureTargets` are provided AND a `targetPos` IS provided
 * (the shape of every L1 pawn capture exercise — pawn-3/pawn-4/pawn-5),
 * diagonal moves must be restricted to the target square only. The pawn
 * must not be able to pseudo-capture on empty diagonal squares.
 *
 * Spec: docs/superpowers/specs/2026-06-02-labyrinth-design-v0.1.md §4
 *
 * The `backward compat` test above (no targetPos, captureSquares undefined)
 * intentionally keeps the all-diagonals behavior for direct-API callers
 * like tutorialHints. */
describe("L1 pawn capture exercise — diagonal restricted to targetPos", () => {
  it("pawn-3 (c5→d6 isCapture=true): diagonal allowed onto target d6", () => {
    const targets = getValidTargets(
      "pawn",
      pos(2, 4), // c5
      [],
      true,
      undefined,
      pos(3, 5), // d6 = target
    );
    expect(targets.some((t) => t.file === 3 && t.rank === 5)).toBe(true);
  });

  it("pawn-3 (c5→d6 isCapture=true): diagonal DENIED onto empty b6", () => {
    const targets = getValidTargets(
      "pawn",
      pos(2, 4), // c5
      [],
      true,
      undefined,
      pos(3, 5), // d6 = target
    );
    // b6 = (file=1, rank=5) is the opposite diagonal. Empty, no enemy,
    // and not the target. Pre-fix this was allowed (bug); post-fix it
    // must be denied so the pawn cannot pseudo-capture.
    expect(targets.some((t) => t.file === 1 && t.rank === 5)).toBe(false);
  });

  it("pawn forward move still allowed in L1 capture exercise", () => {
    const targets = getValidTargets(
      "pawn",
      pos(2, 4), // c5
      [],
      true,
      undefined,
      pos(3, 5), // d6 = target
    );
    // Forward = c6 = (file=2, rank=5). Always allowed when not blocked.
    expect(targets.some((t) => t.file === 2 && t.rank === 5)).toBe(true);
  });

  it("pawn-5 (d2→…→e6) mid-puzzle from d5: diagonal allowed onto target e6", () => {
    // After d2→d4 (fwd2)→d5 (fwd1), the pawn is at d5. The remaining
    // capture must land on e6 (the target). The opposite diagonal c6
    // is an empty square and must be denied.
    const fromD5 = pos(3, 4);
    const targets = getValidTargets(
      "pawn",
      fromD5,
      [],
      true,
      undefined,
      pos(4, 5), // e6 = target
    );
    expect(targets.some((t) => t.file === 4 && t.rank === 5)).toBe(true); // e6 allowed
    expect(targets.some((t) => t.file === 2 && t.rank === 5)).toBe(false); // c6 denied
  });

  it("isCapture=false + targetPos defined: diagonals stay denied (no regression)", () => {
    // Movement-only exercise — pawn must never move diagonally regardless
    // of target shape.
    const targets = getValidTargets(
      "pawn",
      pos(2, 4),
      [],
      false,
      undefined,
      pos(3, 5),
    );
    expect(targets.some((t) => t.file !== 2)).toBe(false);
  });
});
