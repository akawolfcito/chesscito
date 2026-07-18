import { describe, expect, it } from "vitest";

import { getBishopMoves } from "@/lib/game/rules/bishop";
import { computeExerciseBfs } from "@/lib/game/exercise-bfs";
import { EXERCISES } from "@/lib/game/exercises";
import type { BoardPosition, Exercise } from "@/lib/game/types";

/**
 * B4.3 — bishop movement + curriculum BFS guards (the piece had no dedicated
 * rules test; the queen did). Pins the four-diagonal ray model, colour
 * invariance, the no-rank/file rule, and every curated exercise's optimalMoves
 * and load-bearing obstacles.
 */
const P = (sq: string): BoardPosition => ({
  file: "abcdefgh".indexOf(sq[0]),
  rank: Number(sq[1]) - 1,
});
const has = (moves: BoardPosition[], sq: string) =>
  moves.some((m) => m.file === P(sq).file && m.rank === P(sq).rank);

describe("getBishopMoves", () => {
  it("radiates on all four diagonals from the centre", () => {
    const moves = getBishopMoves(P("d4"));
    for (const sq of ["e5", "c5", "e3", "c3", "a1", "h8", "a7", "g1"]) {
      expect(has(moves, sq), `d4 should reach ${sq}`).toBe(true);
    }
  });

  it("has a single ray from a corner", () => {
    const moves = getBishopMoves(P("a1"));
    expect(has(moves, "h8")).toBe(true);
    // No NW/SE/SW ray exists from the corner.
    expect(has(moves, "b8")).toBe(false);
    expect(moves.every((m) => m.file === m.rank)).toBe(true);
  });

  it("stops the ray at the first blocker and never lands on it", () => {
    const moves = getBishopMoves(P("a1"), [P("c3")]);
    expect(has(moves, "b2")).toBe(true); // before the blocker
    expect(has(moves, "c3")).toBe(false); // the blocker square itself
    expect(has(moves, "d4")).toBe(false); // beyond the blocker
  });

  it("never changes colour", () => {
    for (const origin of ["a1", "d4", "h1", "c6"]) {
      const o = P(origin);
      const colour = (o.file + o.rank) % 2;
      for (const m of getBishopMoves(o)) {
        expect((m.file + m.rank) % 2).toBe(colour);
      }
    }
  });

  it("never produces a rank or file move", () => {
    for (const m of getBishopMoves(P("d4"))) {
      expect(m.file === P("d4").file && m.rank === P("d4").rank).toBe(false);
      // A diagonal move changes BOTH file and rank.
      expect(m.file).not.toBe(P("d4").file);
      expect(m.rank).not.toBe(P("d4").rank);
    }
  });
});

describe("bishop curriculum BFS", () => {
  it("every exercise is solvable and its stored optimalMoves is the true BFS minimum", () => {
    // The declared optimalMoves is validated AGAINST the real BFS, not a
    // hardcoded parallel copy. Intentional position/difficulty edits (via the
    // builder, which recomputes optimalMoves) stay green as long as the stored
    // value is honest — the only property that actually matters.
    for (const ex of EXERCISES.bishop) {
      const bfs = computeExerciseBfs("bishop", ex);
      expect(bfs, `${ex.id} is unsolvable`).not.toBeNull();
      expect(bfs!.optimalMoves, `${ex.id} optimalMoves drift`).toBe(ex.optimalMoves);
    }
  });

  it("every obstacle is load-bearing (removing them lowers the optimal)", () => {
    for (const ex of EXERCISES.bishop) {
      if (!ex.obstacles?.length) continue;
      const cleared: Exercise = { ...ex, obstacles: [] };
      const withOut = computeExerciseBfs("bishop", cleared);
      expect(withOut, `${ex.id} unsolvable without obstacles`).not.toBeNull();
      expect(
        withOut!.optimalMoves,
        `${ex.id} obstacles are decorative`,
      ).toBeLessThan(ex.optimalMoves);
    }
  });

  it("keeps unique, stable ids (no bishop-9, id-keyed progress safe)", () => {
    const ids = EXERCISES.bishop.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain("bishop-9");
  });
});
