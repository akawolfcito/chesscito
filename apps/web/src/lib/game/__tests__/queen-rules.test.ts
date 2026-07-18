import { describe, expect, it } from "vitest";
import type { BoardPosition } from "@/lib/game/types";
import { getQueenMoves } from "@/lib/game/rules/queen";
import { getValidTargets } from "@/lib/game/board";
import { EXERCISES } from "@/lib/game/exercises";

const pos = (file: number, rank: number) => ({ file, rank });
const posKey = (p: BoardPosition) => `${p.file},${p.rank}`;

/** BFS over queen moves with blockers, returns min depth or null if
 *  unreachable ≤ maxDepth. */
function bfsQueenDepth(
  start: BoardPosition,
  target: BoardPosition,
  blockers: BoardPosition[],
  maxDepth: number,
): number | null {
  if (start.file === target.file && start.rank === target.rank) return 0;
  let frontier = [start];
  const visited = new Set<string>([posKey(start)]);
  for (let depth = 1; depth <= maxDepth; depth++) {
    const next: BoardPosition[] = [];
    for (const sq of frontier) {
      for (const move of getQueenMoves(sq, blockers)) {
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

describe("Queen movement — horizontal (rook-like)", () => {
  it("moves horizontally from a1 across rank 0", () => {
    const moves = getQueenMoves(pos(0, 0));
    const sameRank = moves.filter((m) => m.rank === 0).map((m) => m.file);
    expect(sameRank.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("moves horizontally from e4 across rank 3", () => {
    const moves = getQueenMoves(pos(4, 3));
    const sameRank = moves.filter((m) => m.rank === 3).map((m) => m.file);
    expect(sameRank.sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 5, 6, 7]);
  });
});

describe("Queen movement — vertical (rook-like)", () => {
  it("moves vertically from a1 up file 0", () => {
    const moves = getQueenMoves(pos(0, 0));
    const sameFile = moves.filter((m) => m.file === 0).map((m) => m.rank);
    expect(sameFile.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("moves vertically from e4 up file 4", () => {
    const moves = getQueenMoves(pos(4, 3));
    const sameFile = moves.filter((m) => m.file === 4).map((m) => m.rank);
    expect(sameFile.sort((a, b) => a - b)).toEqual([0, 1, 2, 4, 5, 6, 7]);
  });
});

describe("Queen movement — diagonal (bishop-like)", () => {
  it("moves diagonally from a1 along main diagonal", () => {
    const moves = getQueenMoves(pos(0, 0));
    const mainDiagonal = moves.filter(
      (m) => m.file === m.rank && m.file !== 0,
    ).map((m) => m.file);
    expect(mainDiagonal.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("moves diagonally from e4 along both diagonals", () => {
    const moves = getQueenMoves(pos(4, 3));
    const diag1 = moves.filter((m) => m.file - 4 === m.rank - 3 && (m.file !== 4 || m.rank !== 3));
    const diag2 = moves.filter((m) => m.file - 4 === -(m.rank - 3) && (m.file !== 4 || m.rank !== 3));
    expect(diag1.length).toBeGreaterThan(0);
    expect(diag2.length).toBeGreaterThan(0);
  });
});

describe("Queen movement — blockers", () => {
  it("stops before a blocker on the same rank", () => {
    const moves = getQueenMoves(pos(0, 0), [pos(3, 0)]);
    const sameRank = moves.filter((m) => m.rank === 0).map((m) => m.file);
    expect(sameRank.sort((a, b) => a - b)).toEqual([1, 2]);
  });

  it("does not include the blocker square", () => {
    const obstacle = pos(3, 0);
    const moves = getQueenMoves(pos(0, 0), [obstacle]);
    const containsObstacle = moves.some(
      (m) => m.file === obstacle.file && m.rank === obstacle.rank,
    );
    expect(containsObstacle).toBe(false);
  });

  it("stops before a blocker on the same diagonal", () => {
    const moves = getQueenMoves(pos(0, 0), [pos(3, 3)]);
    const blockedDiagonal = moves.filter(
      (m) => m.file === m.rank && m.file > 0,
    ).map((m) => m.file);
    expect(blockedDiagonal.sort((a, b) => a - b)).toEqual([1, 2]);
  });

  it("blocks on both cardinal and diagonal independently", () => {
    const moves = getQueenMoves(pos(3, 3), [pos(3, 5), pos(5, 5)]);
    const north = moves.filter((m) => m.file === 3 && m.rank > 3).map((m) => m.rank);
    const neDiagonal = moves.filter(
      (m) => m.file - 3 === m.rank - 3 && m.file > 3,
    ).map((m) => m.file);
    expect(north.sort((a, b) => a - b)).toEqual([4]);
    expect(neDiagonal.sort((a, b) => a - b)).toEqual([4]);
  });
});

describe("Queen movement — integration via getValidTargets", () => {
  it("returns non-empty targets with no blockers", () => {
    const targets = getValidTargets("queen", pos(0, 0), [], false);
    expect(targets.length).toBeGreaterThan(0);
  });

  it("honours blockers when called through getValidTargets", () => {
    const targets = getValidTargets("queen", pos(0, 0), [pos(3, 0)], false);
    const blocked = targets.some((t) => t.file === 3 && t.rank === 0);
    expect(blocked).toBe(false);
  });
});

describe("Queen L1 exercises — data integrity", () => {
  const queenExercises = EXERCISES.queen;

  it("has exactly 10 exercises (5 Easy + 5 Medium, Rotation wave 1)", () => {
    expect(queenExercises.length).toBe(10);
  });

  it("every exercise has a unique id", () => {
    const ids = queenExercises.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every exercise has valid board positions", () => {
    for (const ex of queenExercises) {
      expect(ex.startPos.file).toBeGreaterThanOrEqual(0);
      expect(ex.startPos.file).toBeLessThan(8);
      expect(ex.startPos.rank).toBeGreaterThanOrEqual(0);
      expect(ex.startPos.rank).toBeLessThan(8);
      expect(ex.targetPos.file).toBeGreaterThanOrEqual(0);
      expect(ex.targetPos.file).toBeLessThan(8);
      expect(ex.targetPos.rank).toBeGreaterThanOrEqual(0);
      expect(ex.targetPos.rank).toBeLessThan(8);
    }
  });

  it("every exercise has positive optimalMoves", () => {
    for (const ex of queenExercises) {
      expect(ex.optimalMoves).toBeGreaterThan(0);
    }
  });

  it("every exercise has distinct start and target", () => {
    for (const ex of queenExercises) {
      const same =
        ex.startPos.file === ex.targetPos.file &&
        ex.startPos.rank === ex.targetPos.rank;
      expect(same).toBe(false);
    }
  });
});

describe("Queen L1 exercises — honest optimalMoves (data-derived)", () => {
  // No hardcoded per-id coordinates: the builder recomputes optimalMoves on
  // Save, so intentional position/difficulty edits stay green. We assert only
  // the property that must ALWAYS hold — the stored optimum is the TRUE BFS
  // minimum on the exercise's own board (reachable in exactly optimalMoves,
  // and not in fewer). Solvability across all pieces is also covered generically
  // by exercise-bfs.test.ts.
  it.each(EXERCISES.queen.map((e) => e.id))(
    "%s reaches target in exactly its stored optimalMoves, not fewer",
    (id) => {
      const ex = EXERCISES.queen.find((e) => e.id === id)!;
      const optimal = ex.optimalMoves;
      const obstacles = ex.obstacles ?? [];
      expect(
        bfsQueenDepth(ex.startPos, ex.targetPos, obstacles, optimal),
        `${id} not reachable in ${optimal}`,
      ).toBe(optimal);
      if (optimal > 1) {
        expect(
          bfsQueenDepth(ex.startPos, ex.targetPos, obstacles, optimal - 1),
          `${id} reachable faster than ${optimal}`,
        ).toBeNull();
      }
    },
  );
});
