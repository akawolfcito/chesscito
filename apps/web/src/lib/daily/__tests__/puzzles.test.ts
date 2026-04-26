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
