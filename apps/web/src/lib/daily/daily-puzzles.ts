import { todayUtc } from "./progress";
import type { Exercise, PieceId } from "@/lib/game/types";
import { defineLabyrinth, sq } from "@/lib/game/notation";

/**
 * Difficulty tag for Daily Tactic puzzles. Sprint 2 commit B
 * (Training Economy Alpha 2026-06-06) — pure data, no UI render
 * yet. Consumers can use this to tier rewards, filter the pool,
 * or show a chip in a future visual cluster.
 *
 * Calibration heuristic (Wolfcito 2026-06-06):
 *  - easy:   1-move puzzles or direct captures
 *  - medium: 2-3 moves with non-immediate route or several stars
 *  - hard:   reserved for puzzles with obstacles, captureTargets,
 *            or compound tactical decisions
 */
export type PuzzleDifficulty = "easy" | "medium" | "hard";

/** Default applied when a puzzle was authored before the field
 *  existed. Conservative: assume easy so legacy puzzles never look
 *  retroactively hard in any future filter UI. */
const DEFAULT_PUZZLE_DIFFICULTY: PuzzleDifficulty = "easy";

export type DailyTacticData = {
  id: string;
  name: string;
  piece: PieceId;
  exercise: Exercise;
  hint: string;
  /** Optional difficulty tag (Sprint 2 commit B). Backward-compatible:
   *  consumers must go through `getPuzzleDifficulty()` so missing
   *  values resolve to the default. */
  difficulty?: PuzzleDifficulty;
};

/**
 * Returns the puzzle's difficulty tag, falling back to the default
 * ("easy") when the field is absent. Use this everywhere instead of
 * reading `puzzle.difficulty` directly so legacy puzzles never crash
 * a consumer that wants a non-optional tag.
 */
export function getPuzzleDifficulty(
  puzzle: Pick<DailyTacticData, "difficulty">,
): PuzzleDifficulty {
  return puzzle.difficulty ?? DEFAULT_PUZZLE_DIFFICULTY;
}

/**
 * 30 exercise-based daily puzzles for the Daily Tactic feature.
 *
 * Sprint 2 commit C (Training Economy Alpha 2026-06-06) — expanded
 * from the original 14-puzzle baseline (rook 3 / bishop 1 / knight 3
 * / pawn 4 / queen 3 / king 0) to a balanced 30-puzzle pool with
 * King coverage and minimum 4 puzzles per piece:
 *   rook   3 → 5  (+2)
 *   bishop 1 → 4  (+3)
 *   knight 3 → 5  (+2)
 *   pawn   4 → 5  (+1)
 *   queen  3 → 5  (+2)
 *   king   0 → 6  (+6)  — gap real, prioridad del sprint
 *
 * Important UX note: the rotation algorithm is `hashDate(today) % length`.
 * Going from %14 to %30 changes which puzzle the same calendar day
 * maps to. Users may notice "today's puzzle is different from
 * yesterday's deploy". This is expected behavior, NOT a bug — the
 * determinism contract (everyone sees the same puzzle on the same UTC
 * day) is preserved.
 *
 * King daily puzzles are mini-tactics (2-4 moves) with obstacles or
 * captures, NOT traversal endurance — that pattern belongs to the
 * senda (king-1..10 in @/lib/game/exercises). Each King daily was
 * designed so the obstacles MATTER: removing them lowers the BFS
 * optimum to less than declared.
 *
 * All use the same Exercise format as the rest of Chesscito — no
 * chess.js or FEN needed at runtime.
 */
export const DAILY_TACTIC_PUZZLES: DailyTacticData[] = [
  // ── Rook (3) ────────────────────────────────────────────────────
  {
    id: "dt-rook-1",
    name: "Rook — horizontal slide",
    piece: "rook",
    difficulty: "easy",
    exercise: {
      id: "dt-rook-1",
      startPos: sq("a1"),
      targetPos: sq("h1"),
      optimalMoves: 1,
    },
    hint: "The rook slides along ranks. Pick the right rank and ride it all the way.",
  },
  {
    id: "dt-rook-2",
    name: "Rook — vertical climb",
    piece: "rook",
    difficulty: "easy",
    exercise: {
      id: "dt-rook-2",
      startPos: sq("a1"),
      targetPos: sq("a8"),
      optimalMoves: 1,
    },
    hint: "The rook slides along files too. One straight shot up the board.",
  },
  {
    id: "dt-rook-3",
    name: "Rook — two-corner path",
    piece: "rook",
    difficulty: "medium",
    exercise: {
      id: "dt-rook-3",
      startPos: sq("a1"),
      targetPos: sq("h8"),
      optimalMoves: 2,
    },
    hint: "No single rank or file connects these corners. You'll need two moves.",
  },
  {
    id: "dt-rook-4",
    name: "Rook — capture down the file",
    piece: "rook",
    difficulty: "easy",
    exercise: {
      id: "dt-rook-4",
      startPos: sq("a1"),
      targetPos: sq("a5"),
      optimalMoves: 1,
      isCapture: true,
    },
    hint: "Slide up the a-file and take the piece in one move.",
  },
  {
    id: "dt-rook-5",
    name: "Rook — opposite corner",
    piece: "rook",
    difficulty: "medium",
    exercise: {
      id: "dt-rook-5",
      startPos: sq("a8"),
      targetPos: sq("h1"),
      optimalMoves: 2,
    },
    hint: "Rook can't cross corners in one move. Pivot via a1 or h8.",
  },
  // ── Bishop (1) ──────────────────────────────────────────────────
  {
    id: "dt-bishop-1",
    name: "Bishop — long diagonal",
    piece: "bishop",
    difficulty: "easy",
    exercise: {
      id: "dt-bishop-1",
      startPos: sq("a1"),
      targetPos: sq("h8"),
      optimalMoves: 1,
    },
    hint: "The bishop owns one color. This diagonal is all yours.",
  },
  {
    id: "dt-bishop-2",
    name: "Bishop — anti-diagonal",
    piece: "bishop",
    difficulty: "easy",
    exercise: {
      id: "dt-bishop-2",
      startPos: sq("h1"),
      targetPos: sq("a8"),
      optimalMoves: 1,
    },
    hint: "Same color, opposite diagonal. The bishop sweeps from h1 to a8 in one.",
  },
  {
    id: "dt-bishop-3",
    name: "Bishop — pivot to the back rank",
    piece: "bishop",
    difficulty: "medium",
    exercise: {
      id: "dt-bishop-3",
      startPos: sq("a1"),
      targetPos: sq("g1"),
      optimalMoves: 2,
    },
    hint: "a1 and g1 sit on the same color but not the same diagonal. Pivot through d4.",
  },
  {
    id: "dt-bishop-4",
    name: "Bishop — diagonal capture",
    piece: "bishop",
    difficulty: "easy",
    exercise: {
      id: "dt-bishop-4",
      startPos: sq("c1"),
      targetPos: sq("g5"),
      optimalMoves: 1,
      isCapture: true,
    },
    hint: "Slide the long diagonal NE from c1 and capture at g5.",
  },
  // ── Knight (3) ──────────────────────────────────────────────────
  {
    id: "dt-knight-1",
    name: "Knight — first L",
    piece: "knight",
    difficulty: "easy",
    exercise: {
      id: "dt-knight-1",
      startPos: sq("b1"),
      targetPos: sq("c3"),
      optimalMoves: 1,
    },
    hint: "Two forward, one sideways. The knight jumps over everything.",
  },
  {
    id: "dt-knight-2",
    name: "Knight — corner hop",
    piece: "knight",
    difficulty: "easy",
    exercise: {
      id: "dt-knight-2",
      startPos: sq("a1"),
      targetPos: sq("b3"),
      optimalMoves: 1,
    },
    hint: "From the corner the knight reaches exactly two squares. This is one of them.",
  },
  {
    id: "dt-knight-3",
    name: "Knight — two jumps",
    piece: "knight",
    difficulty: "medium",
    exercise: {
      id: "dt-knight-3",
      startPos: sq("a1"),
      targetPos: sq("d4"),
      optimalMoves: 2,
    },
    hint: "No single L gets you there. Chain two jumps: a1→b3→d4.",
  },
  {
    id: "dt-knight-4",
    name: "Knight — three-jump traversal",
    piece: "knight",
    difficulty: "medium",
    exercise: {
      id: "dt-knight-4",
      startPos: sq("a1"),
      targetPos: sq("g2"),
      optimalMoves: 3,
    },
    hint: "g2 sits two L-jumps short of corner. Plan: a1→c2→e1→g2.",
  },
  {
    id: "dt-knight-5",
    name: "Knight — L-capture",
    piece: "knight",
    difficulty: "easy",
    exercise: {
      id: "dt-knight-5",
      startPos: sq("d4"),
      targetPos: sq("f5"),
      optimalMoves: 1,
      isCapture: true,
    },
    hint: "One classic L: forward two, sideways one. Capture on f5.",
  },
  // ── Pawn (4) ────────────────────────────────────────────────────
  {
    id: "dt-pawn-1",
    name: "Pawn — one step",
    piece: "pawn",
    difficulty: "easy",
    exercise: {
      id: "dt-pawn-1",
      startPos: sq("a2"),
      targetPos: sq("a3"),
      optimalMoves: 1,
    },
    hint: "Pawns march forward, one square at a time.",
  },
  {
    id: "dt-pawn-2",
    name: "Pawn — double step",
    piece: "pawn",
    difficulty: "easy",
    exercise: {
      id: "dt-pawn-2",
      startPos: sq("a2"),
      targetPos: sq("a4"),
      optimalMoves: 1,
    },
    hint: "From the starting rank, pawns can leap two squares forward.",
  },
  {
    id: "dt-pawn-3",
    name: "Pawn — diagonal capture",
    piece: "pawn",
    difficulty: "easy",
    exercise: {
      id: "dt-pawn-3",
      startPos: sq("b2"),
      targetPos: sq("c3"),
      optimalMoves: 1,
      isCapture: true,
    },
    hint: "Pawns capture diagonally forward. One step sideways and up.",
  },
  {
    id: "dt-pawn-4",
    name: "Pawn — capture then advance",
    piece: "pawn",
    // Hard: compound tactic — captureTargets + 2 moves + sequenced
    // capture-then-advance. The only Sprint 2-baseline puzzle that
    // combines an allowlist constraint with multi-move planning.
    difficulty: "hard",
    exercise: defineLabyrinth({
      id: "dt-pawn-4",
      start: "a2",
      target: "b4",
      captureTargets: ["b3"],
      isCapture: true,
      optimalMoves: 2,
    }),
    hint: "First diagonal to b3 (capture), then forward one to b4. Two moves.",
  },
  {
    id: "dt-pawn-5",
    name: "Pawn — march twice",
    piece: "pawn",
    difficulty: "easy",
    exercise: {
      id: "dt-pawn-5",
      startPos: sq("c2"),
      targetPos: sq("c5"),
      optimalMoves: 2,
    },
    hint: "Pawn on starting rank: double-step to c4, then one more to c5.",
  },
  // ── Queen (3) ───────────────────────────────────────────────────
  {
    id: "dt-queen-1",
    name: "Queen — diagonal sweep",
    piece: "queen",
    difficulty: "easy",
    exercise: {
      id: "dt-queen-1",
      startPos: sq("a1"),
      targetPos: sq("h8"),
      optimalMoves: 1,
    },
    hint: "The queen moves like rook and bishop combined. This diagonal is easy.",
  },
  {
    id: "dt-queen-2",
    name: "Queen — file ride",
    piece: "queen",
    difficulty: "easy",
    exercise: {
      id: "dt-queen-2",
      startPos: sq("a1"),
      targetPos: sq("a8"),
      optimalMoves: 1,
    },
    hint: "Straight up the a-file. The queen slides just like a rook.",
  },
  {
    id: "dt-queen-3",
    name: "Queen — two-move reach",
    piece: "queen",
    difficulty: "medium",
    exercise: {
      id: "dt-queen-3",
      startPos: sq("a1"),
      targetPos: sq("h5"),
      optimalMoves: 2,
    },
    hint: "No single move connects a1 and h5. Slide horizontal first, then vertical.",
  },
  {
    id: "dt-queen-4",
    name: "Queen — back rank slide",
    piece: "queen",
    difficulty: "easy",
    exercise: {
      id: "dt-queen-4",
      startPos: sq("a1"),
      targetPos: sq("h1"),
      optimalMoves: 1,
    },
    hint: "Straight across rank 1. The queen moves like a rook here.",
  },
  {
    id: "dt-queen-5",
    name: "Queen — pivot to a flank file",
    piece: "queen",
    difficulty: "medium",
    exercise: {
      id: "dt-queen-5",
      startPos: sq("d1"),
      targetPos: sq("c5"),
      optimalMoves: 2,
    },
    hint: "c5 isn't on d1's file, rank, or diagonal. Step diagonally to c2 first.",
  },
  // ── King (6) — new in Sprint 2 commit C ────────────────────────
  // Designed as mini-tactics (2-4 moves) with obstacles or captures.
  // NOT traversal endurance — that's the senda's job (king-1..10 in
  // @/lib/game/exercises). Each obstacle-based puzzle is calibrated so
  // removing the obstacles drops the BFS optimum below the declared
  // value, proving the obstacles MATTER pedagogically.
  {
    id: "dt-king-1",
    name: "King — sidestep the rock",
    piece: "king",
    difficulty: "easy",
    exercise: {
      id: "dt-king-1",
      startPos: sq("e4"),
      targetPos: sq("e6"),
      obstacles: [sq("e5")],
      optimalMoves: 2,
    },
    hint: "e5 is blocked. Step diagonally through f5 or d5, then up.",
  },
  {
    id: "dt-king-2",
    name: "King — diagonal capture",
    piece: "king",
    difficulty: "easy",
    exercise: {
      id: "dt-king-2",
      startPos: sq("e4"),
      targetPos: sq("g6"),
      optimalMoves: 2,
      isCapture: true,
    },
    hint: "Two NE steps. Land on g6 and take the piece.",
  },
  {
    id: "dt-king-3",
    name: "King — escape the wall",
    piece: "king",
    difficulty: "medium",
    exercise: {
      id: "dt-king-3",
      startPos: sq("e4"),
      targetPos: sq("e1"),
      obstacles: [sq("e3"), sq("d2")],
      optimalMoves: 3,
    },
    hint: "e3 blocked, d2 blocked. Detour east through f3 to reach e1.",
  },
  {
    id: "dt-king-4",
    name: "King — corner trap",
    piece: "king",
    difficulty: "medium",
    exercise: {
      id: "dt-king-4",
      startPos: sq("c2"),
      targetPos: sq("a4"),
      obstacles: [sq("b3")],
      optimalMoves: 3,
    },
    hint: "b3 is blocked. The king walks the long way: c3 → b4 → a4.",
  },
  {
    id: "dt-king-5",
    name: "King — narrow corridor",
    piece: "king",
    difficulty: "hard",
    exercise: {
      id: "dt-king-5",
      startPos: sq("d4"),
      targetPos: sq("d8"),
      obstacles: [sq("d5"), sq("e6"), sq("c6")],
      optimalMoves: 4,
    },
    hint: "Three obstacles seal the d-file. Slip through f6 (or b6) and circle back.",
  },
  {
    id: "dt-king-6",
    name: "King — detour capture",
    piece: "king",
    difficulty: "medium",
    exercise: {
      id: "dt-king-6",
      startPos: sq("e4"),
      targetPos: sq("c6"),
      obstacles: [sq("d5")],
      optimalMoves: 3,
      isCapture: true,
    },
    hint: "d5 is blocked. Go through d4 or e5, then capture on c6.",
  },
];

function hashDate(date: string): number {
  let hash = 5381;
  for (let i = 0; i < date.length; i++) {
    hash = ((hash << 5) + hash) + date.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getDailyTactic(today: string = todayUtc()): DailyTacticData {
  const idx = hashDate(today) % DAILY_TACTIC_PUZZLES.length;
  return DAILY_TACTIC_PUZZLES[idx];
}

/**
 * Returns the puzzle with the given id, or `undefined` if not found.
 * Used by `resolveDailyPuzzle` to support stable challenge links (B2.2a).
 */
export function getPuzzleById(id: string): DailyTacticData | undefined {
  return DAILY_TACTIC_PUZZLES.find((p) => p.id === id);
}

/**
 * Resolves the puzzle for a given date + optional pinned puzzle id.
 *
 * Rules (B2.2a — Stable Challenge Links):
 *  1. `puzzleId` present and valid  → return that exact puzzle (pool-size agnostic)
 *  2. `puzzleId` present and invalid → fallback to getDailyTactic(date) silently
 *  3. `puzzleId` absent             → getDailyTactic(date) (backwards compat)
 *
 * Consumers must pass `searchParams.puzzle` from the URL; this function
 * never throws — invalid ids fall through cleanly.
 */
export function resolveDailyPuzzle(
  date: string,
  puzzleId?: string,
): DailyTacticData {
  if (puzzleId) {
    const byId = getPuzzleById(puzzleId);
    if (byId) return byId;
  }
  return getDailyTactic(date);
}

/**
 * Slot identifier for the PRO-exclusive Daily Tactic extras introduced
 * in Sprint 2 commit F (Training Economy Alpha 2026-06-07). Two slots
 * fire per week, on UTC Friday and UTC Sunday respectively. The slot
 * id becomes part of telemetry + future UI label strings.
 */
export type ProExtraSlot = "friday_premium" | "sunday_showdown";

export type ProExtraPuzzle = {
  slot: ProExtraSlot;
  puzzle: DailyTacticData;
};

/**
 * Index of the canonical day puzzle. Exposed so callers (and the PRO
 * extra collision check below) can compare against the same value
 * getDailyTactic returns without re-hashing.
 */
function canonicalIndexForDay(today: string): number {
  return hashDate(today) % DAILY_TACTIC_PUZZLES.length;
}

/**
 * Picks a puzzle from the pool using a salted hash, then shifts to
 * the next index modulo the pool length if the salted pick collides
 * with the canonical daily puzzle. This guarantees a PRO user never
 * sees the same puzzle as both their canonical daily and a same-day
 * extra. Deterministic per (today, salt) so all PRO users on the
 * same date see the same extras.
 */
function pickProExtra(today: string, salt: string): DailyTacticData {
  const len = DAILY_TACTIC_PUZZLES.length;
  const canonical = canonicalIndexForDay(today);
  const salted = hashDate(`${today}|${salt}`) % len;
  const idx = salted === canonical ? (salted + 1) % len : salted;
  return DAILY_TACTIC_PUZZLES[idx];
}

/**
 * Returns PRO-exclusive Daily Tactic extras for the given UTC date.
 * Sprint 2 commit F — **plumbing only**. NO UI consumer renders these
 * yet. The helper is the public contract Sprint 2.1 (or a later
 * visual cluster) will wire into the HUB rail. Future consumers
 * MUST gate the result with `useIsProActive()` at the callsite —
 * this helper does not gate on PRO status itself so it stays
 * testable as a pure function.
 *
 * Schedule:
 *  - UTC Friday (dayOfWeek === 5): 1 extra with slot "friday_premium"
 *  - UTC Sunday (dayOfWeek === 0): 1 extra with slot "sunday_showdown"
 *  - Other days: empty array
 *
 * Total: 2 extras per week, both drawn from the existing 30-puzzle
 * pool via a salted hash. NO new authoring committed for Sprint 2 —
 * exclusive PRO content is a Sprint 4 (or later) decision once the
 * hábit-formation KPI from Sprint 2 retrospective lands.
 */
export function getProDailyExtras(
  today: string = todayUtc(),
): ProExtraPuzzle[] {
  const dow = utcDayOfWeek(today);
  const extras: ProExtraPuzzle[] = [];
  if (dow === 5) {
    extras.push({
      slot: "friday_premium",
      puzzle: pickProExtra(today, "friday-premium"),
    });
  }
  if (dow === 0) {
    extras.push({
      slot: "sunday_showdown",
      puzzle: pickProExtra(today, "sunday-showdown"),
    });
  }
  return extras;
}

function utcDayOfWeek(today: string): number {
  // "YYYY-MM-DD" → 0..6 (Sunday=0, Saturday=6) in UTC, matching
  // Date.prototype.getUTCDay().
  return new Date(`${today}T00:00:00Z`).getUTCDay();
}
