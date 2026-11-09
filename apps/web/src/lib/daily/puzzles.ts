import { todayUtc } from "./progress";

export type DailyPuzzle = {
  id: string;
  name: string;
  fen: string;
  solution: { from: string; to: string; promotion?: "q" | "r" | "b" | "n" };
  hint: string;
};

/**
 * Curated mate-in-1 puzzles for the Daily Tactic. Each entry is a
 * starting FEN with white to move. The `solution` is the unique
 * mating move. Validity (FEN parses, move is legal, result is
 * checkmate) is enforced by puzzles.test.ts so a broken seed never
 * ships.
 */
export const DAILY_PUZZLES: DailyPuzzle[] = [
  {
    id: "mt-001",
    name: "Back rank — rook lift",
    fen: "6k1/5ppp/8/8/8/8/8/3R3K w - - 0 1",
    solution: { from: "d1", to: "d8" },
    hint: "The 8th rank is naked — invite the king to sit there.",
  },
  {
    id: "mt-002",
    name: "Queen's kiss",
    // Black king on g8 (was h8) — the original pre-checked position
    // (Qh6 vs Kh8) was illegal at start. Solution Qh6→Qg7 is the
    // unique mate-in-1 here: the queen lands defended by Kg6 so the
    // king cannot capture, and the diagonal/file from g7 covers every
    // escape square.
    fen: "6k1/8/6KQ/8/8/8/8/8 w - - 0 1",
    solution: { from: "h6", to: "g7" },
    hint: "Get the queen close. The king has nowhere to run.",
  },
  {
    id: "mt-003",
    name: "Rook corner",
    fen: "7k/8/6K1/8/8/8/8/R7 w - - 0 1",
    solution: { from: "a1", to: "a8" },
    hint: "All you need is the eighth rank and a covered escape.",
  },
  {
    id: "mt-004",
    name: "Queen sweep",
    // Replaced 2026-05-02. The original Q+K vs K position
    // (Ke8/Ke6/Qc5) had two mates-in-1: the diagonal kiss Qe7 AND
    // the back-rank Qc8 (whose c8–h3 diagonal covered the d7 escape
    // square). Several attempts to repair via piece relocation
    // either re-introduced uniqueness collapse or blocked the
    // queen's path to e7. Replaced with a clean K+Q vs K mate where
    // the queen slides down the long c-file from c8, and Kg3 boxes
    // the kingside escape squares. Same lesson (queen + king
    // coordination), structurally clean.
    fen: "2Q5/8/8/8/8/6K1/8/7k w - - 0 1",
    solution: { from: "c8", to: "c1" },
    hint: "Slide the queen down the file. The 1st rank is sealed and your king covers the kingside.",
  },
  {
    id: "mt-005",
    name: "Long file finish",
    // Queen on a2 (was a1) — the original a1 placement put Kh8 in
    // check via the a1–h8 diagonal at the start (illegal). Same
    // pedagogical idea — long a-file ride to a8 — just one square
    // shorter so the diagonal no longer threatens the king at rest.
    fen: "7k/8/6K1/8/8/8/Q7/8 w - - 0 1",
    solution: { from: "a2", to: "a8" },
    hint: "Same idea, long file ride. The 8th rank is the kill zone.",
  },
  {
    id: "mt-006",
    name: "Smothered mate",
    fen: "6rk/6pp/7N/8/8/8/8/6K1 w - - 0 1",
    solution: { from: "h6", to: "f7" },
    hint: "The king is trapped by his own pieces — only a knight can reach him.",
  },
  {
    id: "mt-007",
    name: "Back-rank queen drop",
    // Queen on g3 (was f3) — the original f3 placement put Kd1 in
    // check via the f3–d1 diagonal at the start (illegal). Moving to
    // g3 also kills the second mating option (Qf1 / Qh1 dual mates
    // from f3) — Qg1 is now the unique mate-in-1, defended in spirit
    // by Kd3's coverage of d2 / e2 / c2.
    fen: "8/8/8/8/8/3K2Q1/8/3k4 w - - 0 1",
    solution: { from: "g3", to: "g1" },
    hint: "Drop the queen on the king's rank. The white king covers d2 / e2 / c2 so the king has nowhere to run.",
  },
];

/** Deterministic non-cryptographic hash so the same date always maps to
 *  the same puzzle across devices. djb2 — good enough for index selection. */
function hashDate(date: string): number {
  let hash = 5381;
  for (let i = 0; i < date.length; i++) {
    hash = ((hash << 5) + hash) + date.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** Returns the puzzle for the given UTC date. Defaults to today. */
export function getDailyPuzzle(today: string = todayUtc()): DailyPuzzle {
  const idx = hashDate(today) % DAILY_PUZZLES.length;
  return DAILY_PUZZLES[idx];
}

/** Strict comparison — the player's move must match the unique solution. */
export function isPuzzleSolution(
  puzzle: DailyPuzzle,
  from: string,
  to: string,
  promotion?: "q" | "r" | "b" | "n",
): boolean {
  const sol = puzzle.solution;
  if (sol.from !== from || sol.to !== to) return false;
  return (sol.promotion ?? null) === (promotion ?? null);
}
