import { describe, expect, it } from "vitest";
import type { BoardPosition, PieceId } from "@/lib/game/types";
import { getRookMoves } from "@/lib/game/rules/rook";
import { getBishopMoves } from "@/lib/game/rules/bishop";
import { getKnightMoves } from "@/lib/game/rules/knight";
import { getPawnMoves } from "@/lib/game/rules/pawn";
import { getQueenMoves } from "@/lib/game/rules/queen";
import { getKingMoves } from "@/lib/game/rules/king";
import { getValidTargets } from "@/lib/game/board";
import {
  DAILY_TACTIC_PUZZLES,
  getDailyTactic,
  getProDailyExtras,
  getPuzzleDifficulty,
  type ProExtraSlot,
  type PuzzleDifficulty,
} from "@/lib/daily/daily-puzzles";

const VALID_DIFFICULTIES: PuzzleDifficulty[] = ["easy", "medium", "hard"];

const pos = (file: number, rank: number): BoardPosition => ({ file, rank });
const PIECE_ORDER: PieceId[] = ["rook", "bishop", "knight", "pawn", "queen", "king"];

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
  it("has exactly 30 puzzles", () => {
    expect(DAILY_TACTIC_PUZZLES).toHaveLength(30);
  });

  it("all IDs are unique", () => {
    const ids = DAILY_TACTIC_PUZZLES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("piece distribution: rook=5, bishop=4, knight=5, pawn=5, queen=5, king=6 (Sprint 2)", () => {
    const counts: Record<string, number> = {};
    for (const p of DAILY_TACTIC_PUZZLES) {
      counts[p.piece] = (counts[p.piece] ?? 0) + 1;
    }
    expect(counts).toEqual({
      rook: 5,
      bishop: 4,
      knight: 5,
      pawn: 5,
      queen: 5,
      king: 6,
    });
  });

  it("every piece has at least 4 Daily Tactic puzzles (Sprint 2 floor)", () => {
    const counts: Record<string, number> = {};
    for (const p of DAILY_TACTIC_PUZZLES) {
      counts[p.piece] = (counts[p.piece] ?? 0) + 1;
    }
    for (const piece of PIECE_ORDER) {
      expect(counts[piece] ?? 0, `${piece} has fewer than 4 puzzles`).toBeGreaterThanOrEqual(4);
    }
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
        case "king":
          // King move generator shares the same (pos, blockers) signature
          // as sliding pieces, so bfsSlidingDepth handles it directly.
          // Added in Sprint 2 commit C (2026-06-06) for the King daily
          // puzzles dt-king-1..6.
          found = bfsSlidingDepth(
            exercise.startPos, exercise.targetPos, blockers, getKingMoves, exercise.optimalMoves,
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
        case "king":
          found = bfsSlidingDepth(
            exercise.startPos, exercise.targetPos, blockers, getKingMoves, subOptimal,
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

  it("rotation result shape is unchanged — still returns a DailyTacticData with id/name/piece/exercise/hint", () => {
    const puzzle = getDailyTactic("2026-05-15");
    expect(puzzle).toHaveProperty("id");
    expect(puzzle).toHaveProperty("name");
    expect(puzzle).toHaveProperty("piece");
    expect(puzzle).toHaveProperty("exercise");
    expect(puzzle).toHaveProperty("hint");
    // difficulty is now part of the shape but accessed through the helper
    expect(VALID_DIFFICULTIES).toContain(getPuzzleDifficulty(puzzle));
  });
});

describe("daily-tactic-puzzles — difficulty", () => {
  it("getPuzzleDifficulty returns the explicit value when present", () => {
    expect(getPuzzleDifficulty({ difficulty: "easy" })).toBe("easy");
    expect(getPuzzleDifficulty({ difficulty: "medium" })).toBe("medium");
    expect(getPuzzleDifficulty({ difficulty: "hard" })).toBe("hard");
  });

  it("getPuzzleDifficulty returns the default (easy) when difficulty is missing", () => {
    expect(getPuzzleDifficulty({})).toBe("easy");
    expect(getPuzzleDifficulty({ difficulty: undefined })).toBe("easy");
  });

  it("every puzzle resolves to a valid difficulty", () => {
    for (const puzzle of DAILY_TACTIC_PUZZLES) {
      const d = getPuzzleDifficulty(puzzle);
      expect(
        VALID_DIFFICULTIES,
        `${puzzle.id} resolved to invalid difficulty "${d}"`,
      ).toContain(d);
    }
  });

  it("every puzzle declares difficulty explicitly (no implicit defaults left)", () => {
    // Stronger guard than the previous test — catches the case where a
    // new puzzle is added without setting `difficulty` and silently
    // falls through to the default. Authors must opt in.
    for (const puzzle of DAILY_TACTIC_PUZZLES) {
      expect(
        puzzle.difficulty,
        `${puzzle.id} is missing an explicit difficulty`,
      ).toBeDefined();
    }
  });

  it("Sprint 2 post-expansion distribution: 18 easy / 10 medium / 2 hard", () => {
    // Baseline (commit B) was 10/3/1 across 14 puzzles. Commit C added
    // 8 easy + 7 medium + 1 hard across the 16 new puzzles, biasing
    // toward easy/medium because Daily Tactic prioritizes habit and
    // clarity over difficulty per Wolfcito directive 2026-06-06.
    const counts: Record<PuzzleDifficulty, number> = { easy: 0, medium: 0, hard: 0 };
    for (const puzzle of DAILY_TACTIC_PUZZLES) {
      counts[getPuzzleDifficulty(puzzle)] += 1;
    }
    expect(counts).toEqual({ easy: 18, medium: 10, hard: 2 });
  });
});

/**
 * Sprint 2 commit F — PRO extras Friday + Sunday. Plumbing-only
 * helper; no UI consumer yet. These tests pin the contract so a
 * future visual cluster can wire the helper without re-litigating
 * the schedule, slot ids, or deterministic-per-date guarantee.
 */
describe("daily-tactic-puzzles — PRO extras", () => {
  // 2026-06-07 is a UTC Sunday → 1 extra, slot "sunday_showdown".
  // 2026-06-12 is a UTC Friday → 1 extra, slot "friday_premium".
  // 2026-06-08..2026-06-11 (Mon-Thu) + 2026-06-13 (Sat) → no extras.
  const KNOWN_FRIDAY = "2026-06-12";
  const KNOWN_SUNDAY = "2026-06-07";
  const KNOWN_MONDAY = "2026-06-08";
  const KNOWN_SATURDAY = "2026-06-13";

  it("returns 1 extra on UTC Friday with slot 'friday_premium'", () => {
    const extras = getProDailyExtras(KNOWN_FRIDAY);
    expect(extras).toHaveLength(1);
    expect(extras[0]!.slot).toBe<ProExtraSlot>("friday_premium");
  });

  it("returns 1 extra on UTC Sunday with slot 'sunday_showdown'", () => {
    const extras = getProDailyExtras(KNOWN_SUNDAY);
    expect(extras).toHaveLength(1);
    expect(extras[0]!.slot).toBe<ProExtraSlot>("sunday_showdown");
  });

  it("returns no extras on UTC Monday", () => {
    expect(getProDailyExtras(KNOWN_MONDAY)).toEqual([]);
  });

  it("returns no extras on UTC Saturday", () => {
    expect(getProDailyExtras(KNOWN_SATURDAY)).toEqual([]);
  });

  it("is deterministic — same date yields the same extra puzzle id", () => {
    const a = getProDailyExtras(KNOWN_FRIDAY);
    const b = getProDailyExtras(KNOWN_FRIDAY);
    expect(a[0]!.puzzle.id).toBe(b[0]!.puzzle.id);
  });

  it("extra puzzle is always one of the 30 pool entries", () => {
    const ids = new Set(DAILY_TACTIC_PUZZLES.map((p) => p.id));
    const friday = getProDailyExtras(KNOWN_FRIDAY);
    const sunday = getProDailyExtras(KNOWN_SUNDAY);
    expect(ids.has(friday[0]!.puzzle.id)).toBe(true);
    expect(ids.has(sunday[0]!.puzzle.id)).toBe(true);
  });

  it("never collides with the canonical daily puzzle on the same date", () => {
    // Sweep an entire 4-week window (28 days) covering 4 Fridays + 4
    // Sundays. For each one, the canonical daily and the PRO extra
    // MUST differ. The salted-hash + (idx+1)%len shift is what
    // guarantees this; the test pins the contract.
    const start = new Date("2026-06-01T00:00:00Z");
    for (let i = 0; i < 28; i++) {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + i);
      const today = d.toISOString().slice(0, 10);
      const canonical = getDailyTactic(today);
      for (const extra of getProDailyExtras(today)) {
        expect(
          extra.puzzle.id,
          `${today} (${extra.slot}) collided with canonical ${canonical.id}`,
        ).not.toBe(canonical.id);
      }
    }
  });

  it("yields varied puzzles across consecutive Fridays (hash variance proof)", () => {
    // 4 consecutive UTC Fridays starting 2026-06-12.
    const fridays = ["2026-06-12", "2026-06-19", "2026-06-26", "2026-07-03"];
    const ids = new Set<string>();
    for (const f of fridays) ids.add(getProDailyExtras(f)[0]!.puzzle.id);
    // 4 Fridays should not all collapse to the same puzzle. ≥2 is a
    // soft signal that the salted hash is doing its job.
    expect(ids.size).toBeGreaterThanOrEqual(2);
  });

  it("returns at most 1 entry per day (Friday OR Sunday, never both same UTC day)", () => {
    // No UTC date is simultaneously Friday and Sunday, so the helper
    // tops out at 1 extra. This test is a contract pin: if a future
    // day type is added (e.g., a midweek bonus), this assertion is
    // expected to be updated rather than silently broken.
    const fridayExtras = getProDailyExtras(KNOWN_FRIDAY);
    const sundayExtras = getProDailyExtras(KNOWN_SUNDAY);
    expect(fridayExtras.length).toBeLessThanOrEqual(1);
    expect(sundayExtras.length).toBeLessThanOrEqual(1);
  });

  it("delivers exactly 2 extras per UTC week (1 Friday + 1 Sunday)", () => {
    // Pick any UTC week boundary, walk 7 days, sum extras. Total
    // must be 2 — one for Friday, one for Sunday. This is the
    // commitment that justifies the "2 extras per week" promise
    // to Wolfcito + the PRO product copy in the decisions doc.
    const start = new Date("2026-06-07T00:00:00Z"); // UTC Sunday
    let total = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + i);
      total += getProDailyExtras(d.toISOString().slice(0, 10)).length;
    }
    expect(total).toBe(2);
  });
});
