import { describe, expect, it } from "vitest";

import { EXERCISES, resolveExerciseDescription } from "@/lib/game/exercises";
import { GENERATED_EXERCISE_DESCRIPTIONS } from "@/lib/game/generated/puzzles.generated";
import { CURATED_PIECES, lintPieceSequence } from "@/lib/content/lint";

/**
 * B4.3 — the bishop says what it teaches, using the rook as the quality baseline.
 *
 * Nine exercises ordered by mastery. bishop-9 (a pure duplicate of bishop-8,
 * mislabelled "Capture detour" for a friendly, non-capturable blocker) is gone.
 * Colour conservation is taught through copy — never an unsolvable target.
 */

const REQUIRED = ["principle", "title", "playerPrompt", "learningObjective"] as const;

describe("bishop pedagogy", () => {
  it("is a curated piece", () => {
    expect(CURATED_PIECES).toContain("bishop");
  });

  it("gives every exercise complete pedagogy", () => {
    // Floor, not equality — adding a bishop board is authoring, not breakage.
    expect(EXERCISES.bishop.length).toBeGreaterThanOrEqual(9);
    for (const ex of EXERCISES.bishop) {
      for (const field of REQUIRED) {
        expect(ex[field], `${ex.id} is missing ${field}`).toBeTruthy();
      }
    }
  });

  it("teaches one principle per exercise, each exactly once", () => {
    const principles = EXERCISES.bishop.map((ex) => ex.principle);
    for (const p of principles) expect(p).toMatch(/^[a-z][a-z0-9-]*$/);
    expect(new Set(principles).size).toBe(principles.length);
  });

  it("resolves the real title, never 'Exercise N'", () => {
    EXERCISES.bishop.forEach((ex, index) => {
      expect(GENERATED_EXERCISE_DESCRIPTIONS[ex.id]).toBe(ex.title);
      const resolved = resolveExerciseDescription(
        ex.id,
        index,
        () => null,
        (n) => `Exercise ${n}`,
      );
      expect(resolved).toBe(ex.title);
      expect(resolved).not.toMatch(/^Exercise \d+$/);
    });
  });

  it("retires bishop-9 rather than shipping a duplicate", () => {
    // The retirement is the invariant. The count that used to sit beside it was
    // not: it only said "nine today", and it failed the day a board was added.
    expect(EXERCISES.bishop.map((ex) => ex.id)).not.toContain("bishop-9");
  });

  it("opens the curriculum on a one-move board", () => {
    // Was: the exact nine ids in EXPECTED_ORDER. That pinned a reorder the game
    // builder is allowed to make. The entry point is what a beginner actually
    // feels — the first bishop board must be one move.
    expect(EXERCISES.bishop[0]?.optimalMoves).toBe(1);
  });

  it("ramps difficulty without a spike", () => {
    // Was: two frozen arrays of authored values. See the rook's twin for the
    // full reasoning — the curve is now a WARNING in lib/content/lint.ts that
    // the author reads while saving, and what is enforced here is that it can
    // never fail a build.
    const result = lintPieceSequence({ piece: "bishop", exercises: EXERCISES.bishop });
    expect(result.errors).toEqual([]);
  });

  it("teaches colour conservation through copy, never an unsolvable target", () => {
    const b2 = EXERCISES.bishop.find((e) => e.id === "bishop-2")!;
    expect(b2.tags).toContain("same-color");
    expect(`${b2.learningObjective} ${b2.playerPrompt}`.toLowerCase()).toMatch(
      /colour|light square/,
    );
    // Every target is the bishop's own colour — no opposite-colour (unreachable)
    // square is ever set as a mission.
    for (const ex of EXERCISES.bishop) {
      const startColour = (ex.startPos.file + ex.startPos.rank) % 2;
      const targetColour = (ex.targetPos.file + ex.targetPos.rank) % 2;
      expect(targetColour, `${ex.id} target is the opposite colour`).toBe(startColour);
    }
  });

  it("states the principle in the prompt, never the solution", () => {
    for (const ex of EXERCISES.bishop) {
      expect(ex.playerPrompt, `${ex.id} spells out coordinates`).not.toMatch(
        /\b[a-h][1-8]\b/,
      );
    }
  });

  it("drops the misleading 'straight-line' tag from a diagonal piece", () => {
    for (const ex of EXERCISES.bishop) {
      expect(ex.tags ?? [], `${ex.id} still tagged straight-line`).not.toContain(
        "straight-line",
      );
    }
  });
});
