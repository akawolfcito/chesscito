import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { DAILY_PUZZLES, getDailyPuzzle, isPuzzleSolution } from "../puzzles";

describe("daily puzzles — seed integrity", () => {
  it("seed is non-empty and ids are unique", () => {
    expect(DAILY_PUZZLES.length).toBeGreaterThan(0);
    const ids = DAILY_PUZZLES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(DAILY_PUZZLES)("$id ($name) — FEN parses, solution mates", (puzzle) => {
    const game = new Chess(puzzle.fen);
    expect(game.fen()).toContain(puzzle.fen.split(" ").slice(0, 4).join(" "));

    const result = game.move({
      from: puzzle.solution.from,
      to: puzzle.solution.to,
      promotion: puzzle.solution.promotion,
    });
    expect(result, `solution ${puzzle.solution.from}→${puzzle.solution.to} must be legal`).not.toBeNull();
    expect(game.isCheckmate(), `solution must produce checkmate for puzzle ${puzzle.id}`).toBe(true);
  });

  // The Daily Tactic UI hardcodes "White to move, mate in one." All v1
  // puzzles must match that promise. If a future puzzle wants a different
  // side-to-move, that's a separate spec change.
  it.each(DAILY_PUZZLES)("$id — side-to-move is white", (puzzle) => {
    const sideToMove = puzzle.fen.split(" ")[1];
    expect(sideToMove, `${puzzle.id} FEN side-to-move must be 'w'`).toBe("w");
  });

  // The opponent (whoever is NOT to move) must NOT be in check at the
  // start of a legal position. chess.js's isCheck() reports the
  // side-to-move's check; we flip the FEN to introspect the opponent.
  // This is the validator that catches mt-002 / mt-005 / mt-007 — pre-
  // existing FENs that left black king in check on white's turn.
  it.each(DAILY_PUZZLES)(
    "$id ($name) — opponent NOT pre-checked at start",
    (puzzle) => {
      const swappedFen = puzzle.fen.replace(" w ", " b ");
      const opponent = new Chess(swappedFen);
      expect(
        opponent.isCheck(),
        `${puzzle.id} starts with the opponent's king already in check — illegal position`,
      ).toBe(false);
    },
  );

  // Mate-in-one puzzles MUST have a unique mating move. Two mating
  // candidates would let the player solve the puzzle without finding
  // the intended idea, defeating the pedagogical point.
  it.each(DAILY_PUZZLES)("$id — solution is the UNIQUE mate-in-1", (puzzle) => {
    const game = new Chess(puzzle.fen);
    const candidates = game.moves({ verbose: true });
    const matingMoves = candidates.filter((m) => {
      const probe = new Chess(puzzle.fen);
      probe.move(m);
      return probe.isCheckmate();
    });
    expect(
      matingMoves.length,
      `${puzzle.id} should have exactly 1 mating move; found ${matingMoves.length}: ${matingMoves.map((m) => `${m.from}-${m.to}`).join(", ")}`,
    ).toBe(1);
    expect(matingMoves[0].from).toBe(puzzle.solution.from);
    expect(matingMoves[0].to).toBe(puzzle.solution.to);
  });
});

describe("daily puzzles — rotation", () => {
  it("same date yields the same puzzle", () => {
    const a = getDailyPuzzle("2026-04-25");
    const b = getDailyPuzzle("2026-04-25");
    expect(a.id).toBe(b.id);
  });

  it("different dates exercise multiple puzzles across a 30-day window", () => {
    const seen = new Set<string>();
    const start = new Date("2026-01-01T00:00:00Z");
    for (let i = 0; i < 30; i++) {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + i);
      seen.add(getDailyPuzzle(d.toISOString().slice(0, 10)).id);
    }
    // Hash-mod with 7 puzzles should hit at least 3 distinct ids in a month —
    // anything less suggests the hash is collapsing dates.
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });
});

describe("daily puzzles — isPuzzleSolution", () => {
  const puzzle = DAILY_PUZZLES[0];

  it("matches the exact solution", () => {
    expect(
      isPuzzleSolution(puzzle, puzzle.solution.from, puzzle.solution.to, puzzle.solution.promotion),
    ).toBe(true);
  });

  it("rejects a wrong destination", () => {
    expect(isPuzzleSolution(puzzle, puzzle.solution.from, "a1")).toBe(false);
  });

  it("rejects a wrong source", () => {
    expect(isPuzzleSolution(puzzle, "h1", puzzle.solution.to)).toBe(false);
  });

  it("rejects a missing promotion when the solution requires one", () => {
    const promoPuzzle = {
      ...puzzle,
      solution: { from: "a7", to: "a8", promotion: "q" as const },
    };
    expect(isPuzzleSolution(promoPuzzle, "a7", "a8")).toBe(false);
    expect(isPuzzleSolution(promoPuzzle, "a7", "a8", "q")).toBe(true);
    expect(isPuzzleSolution(promoPuzzle, "a7", "a8", "r")).toBe(false);
  });
});
