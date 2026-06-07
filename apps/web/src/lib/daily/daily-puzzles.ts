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
 * 14 exercise-based daily puzzles for the Daily Tactic feature.
 * Covering rook (3), bishop (1), knight (3), pawn (4), queen (3).
 * Mix of 1-move, 2-move, mini-labyrinth, and pawn capture-target puzzles.
 * All use the same Exercise format as the rest of Chesscito — no chess.js
 * or FEN needed at runtime.
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
