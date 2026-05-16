import { describe, expect, it } from "vitest";
import type { BoardPosition, PieceId } from "@/lib/game/types";
import { getRookMoves } from "@/lib/game/rules/rook";
import { getBishopMoves } from "@/lib/game/rules/bishop";
import { getKnightMoves } from "@/lib/game/rules/knight";
import { getPawnMoves } from "@/lib/game/rules/pawn";
import { getQueenMoves } from "@/lib/game/rules/queen";
import { getValidTargets } from "@/lib/game/board";
import {
  DAILY_TACTIC_PUZZLES,
  getDailyTactic,
} from "@/lib/daily/daily-puzzles";

const pos = (file: number, rank: number): BoardPosition => ({ file, rank });
const PIECE_ORDER: PieceId[] = ["rook", "bishop", "knight", "pawn", "queen"];

function posKey(p: BoardPosition): string {
  return `${p.file},${p.rank}`;
}

/* ── BFS helpers (mirrored from labyrinth.test.ts) ──────── */

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

/* ── Tests ─────────────────────────────────────────────── */

describe("daily-tactic-puzzles — seed integrity", () => {
  it("has exactly 14 puzzles", () => {
    expect(DAILY_TACTIC_PUZZLES).toHaveLength(14);
  });

  it("all IDs are unique", () => {
    const ids = DAILY_TACTIC_PUZZLES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("piece distribution: rook=3, bishop=1, knight=3, pawn=4, queen=3", () => {
    const counts: Record<string, number> = {};
    for (const p of DAILY_TACTIC_PUZZLES) {
      counts[p.piece] = (counts[p.piece] ?? 0) + 1;
    }
    expect(counts).toEqual({ rook: 3, bishop: 1, knight: 3, pawn: 4, queen: 3 });
  });

  it("start and target are distinct for every puzzle", () => {
    for (const p of DAILY_TACTIC_PUZZLES) {
      const s = p.exercise.startPos;
      const t = p.exercise.targetPos;
      expect(
        s.file !== t.file || s.rank !== t.rank,
        `${p.id}: start and target must differ`,
      ).toBe(true);
    }
  });

  it.each(DAILY_TACTIC_PUZZLES)(
    "$id ($name) — reachable at optimalMoves",
    (puzzle) => {
      const { exercise, piece } = puzzle;
      const blockers = exercise.obstacles ?? [];
      const isCapture = exercise.isCapture ?? false;
      const captureTargets = exercise.captureTargets;

      let found: number | null;
      switch (piece) {
        case "rook":
          found = bfsSlidingDepth(
            exercise.startPos, exercise.targetPos, blockers, getRookMoves, exercise.optimalMoves,
          );
          break;
        case "bishop":
          found = bfsSlidingDepth(
            exercise.startPos, exercise.targetPos, blockers, getBishopMoves, exercise.optimalMoves,
          );
          break;
        case "knight":
          found = bfsKnightDepth(
            exercise.startPos, exercise.targetPos, exercise.optimalMoves, blockers,
          );
          break;
        case "pawn": {
          found = bfsPawnDepth(
            exercise.startPos, exercise.targetPos, blockers, isCapture, exercise.optimalMoves,
            captureTargets,
          );
          break;
        }
        case "queen":
          found = bfsSlidingDepth(
            exercise.startPos, exercise.targetPos, blockers, getQueenMoves, exercise.optimalMoves,
          );
          break;
        default:
          found = null;
      }

      expect(
        found,
        `${puzzle.id}: expected optimalMoves=${exercise.optimalMoves}, got depth=${found}`,
      ).toBe(exercise.optimalMoves);
    },
  );

  it.each(DAILY_TACTIC_PUZZLES.filter((p) => p.exercise.optimalMoves > 1))(
    "$id — NOT reachable at optimalMoves - 1",
    (puzzle) => {
      const { exercise, piece } = puzzle;
      const blockers = exercise.obstacles ?? [];
      const isCapture = exercise.isCapture ?? false;
      const captureTargets = exercise.captureTargets;
      const subOptimal = exercise.optimalMoves - 1;

      let found: number | null;
      switch (piece) {
        case "rook":
          found = bfsSlidingDepth(
            exercise.startPos, exercise.targetPos, blockers, getRookMoves, subOptimal,
          );
          break;
        case "bishop":
          found = bfsSlidingDepth(
            exercise.startPos, exercise.targetPos, blockers, getBishopMoves, subOptimal,
          );
          break;
        case "knight":
          found = bfsKnightDepth(
            exercise.startPos, exercise.targetPos, subOptimal, blockers,
          );
          break;
        case "pawn": {
          found = bfsPawnDepth(
            exercise.startPos, exercise.targetPos, blockers, isCapture, subOptimal,
            captureTargets,
          );
          break;
        }
        case "queen":
          found = bfsSlidingDepth(
            exercise.startPos, exercise.targetPos, blockers, getQueenMoves, subOptimal,
          );
          break;
        default:
          found = null;
      }

      expect(
        found,
        `${puzzle.id}: should NOT be reachable in ${subOptimal} moves (needs ${exercise.optimalMoves})`,
      ).toBeNull();
    },
  );
});

describe("daily-tactic-puzzles — rotation", () => {
  it("same date yields the same puzzle", () => {
    const a = getDailyTactic("2026-05-15");
    const b = getDailyTactic("2026-05-15");
    expect(a.id).toBe(b.id);
  });

  it("different dates exercise multiple puzzles across a 30-day window", () => {
    const seen = new Set<string>();
    const start = new Date("2026-01-01T00:00:00Z");
    for (let i = 0; i < 30; i++) {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + i);
      seen.add(getDailyTactic(d.toISOString().slice(0, 10)).id);
    }
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });
});
