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
    fen: "7k/8/6KQ/8/8/8/8/8 w - - 0 1",
    solution: { from: "h6", to: "h7" },
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
    fen: "4k3/8/4K3/2Q5/8/8/8/8 w - - 0 1",
    solution: { from: "c5", to: "e7" },
    hint: "Slide the queen on the diagonal — your king covers the capture.",
  },
  {
    id: "mt-005",
    name: "Long file finish",
    fen: "7k/8/6K1/8/8/8/8/Q7 w - - 0 1",
    solution: { from: "a1", to: "a8" },
    hint: "Same idea, longer ride. The 8th rank is the kill zone.",
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
    fen: "8/8/8/8/8/3K1Q2/8/3k4 w - - 0 1",
    solution: { from: "f3", to: "f1" },
    hint: "Drop the queen on the king's rank. The white king covers d2 and c2.",
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
