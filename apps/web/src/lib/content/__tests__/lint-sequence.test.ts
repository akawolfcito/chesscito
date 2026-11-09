import { describe, expect, it } from "vitest";

import { lintPieceSequence } from "../lint";

/**
 * The difficulty curve is a property of the SEQUENCE, not of any one board, so
 * `lintPuzzle` (which lints a puzzle against its own board) could never see it.
 * It lived instead as a frozen array inside the pedagogy tests, and the game
 * builder broke that array on every save — CI sat red for two days over
 * content the founder had changed on purpose.
 *
 * Founder call (2026-07-21): the curve is a WARNING. It is a judgement about
 * pacing, not a fact decidable from a board, and `lint.ts` already says that a
 * heuristic which breaks the build gets switched off and then protects nothing.
 *
 * These cases use INVENTED sequences, never `EXERCISES`. A rule tested against
 * the live catalog is just the old pin wearing a new hat: it would go red the
 * next time a board moved. What is pinned here is the rule.
 */

const seq = (...optimalMoves: number[]) =>
  optimalMoves.map((n, i) => ({ id: `probe-${i + 1}`, optimalMoves: n }));

describe("lintPieceSequence", () => {
  it("never emits errors — the curve must not be able to break a build", () => {
    // The whole point of the warning/error split. Even the worst curve
    // imaginable stays buildable: the founder ships, the linter advises.
    const awful = lintPieceSequence({ piece: "rook", exercises: seq(9, 1, 9, 1) });
    expect(awful.errors).toEqual([]);
    expect(awful.warnings.length).toBeGreaterThan(0);
  });

  it("passes a curve that only ever holds or steps up", () => {
    const result = lintPieceSequence({
      piece: "rook",
      exercises: seq(1, 1, 1, 2, 2, 3, 4, 4, 5),
    });
    expect(result.warnings).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("warns when the curve goes backwards", () => {
    const result = lintPieceSequence({ piece: "bishop", exercises: seq(1, 2, 4, 3) });
    expect(result.warnings).toHaveLength(1);
    // The message IS the debugging surface (lint.ts house style): it has to
    // name the piece, the step, both ids and both numbers, or the author has
    // to go hunting for which board moved.
    const [warning] = result.warnings;
    expect(warning).toContain("bishop");
    expect(warning).toContain("probe-3");
    expect(warning).toContain("probe-4");
    expect(warning).toMatch(/4.*3|3.*4/);
  });

  it("warns when the curve jumps more than two moves in one step", () => {
    const result = lintPieceSequence({ piece: "rook", exercises: seq(1, 2, 5) });
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("probe-3");
  });

  it("accepts a step of exactly two — the boundary is inclusive", () => {
    // A two-move jump is a lesson, not a wall. Three is where a beginner
    // stops seeing the connection to what they just solved.
    expect(
      lintPieceSequence({ piece: "rook", exercises: seq(1, 3, 5) }).warnings,
    ).toEqual([]);
  });

  it("reports every offending step, not just the first", () => {
    // Today's rook is 1,1,1,2,2,5,4,5,6,9: one jump, one dip, one more jump.
    // An author fixing them one CI run at a time is an author who stops
    // reading the warnings.
    const result = lintPieceSequence({
      piece: "rook",
      exercises: seq(1, 1, 1, 2, 2, 5, 4, 5, 6, 9),
    });
    expect(result.warnings).toHaveLength(3);
  });

  it("says nothing about sequences too short to have a curve", () => {
    expect(lintPieceSequence({ piece: "king", exercises: seq() }).warnings).toEqual([]);
    expect(lintPieceSequence({ piece: "king", exercises: seq(4) }).warnings).toEqual([]);
  });
});
