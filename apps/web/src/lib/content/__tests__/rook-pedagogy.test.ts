import { describe, expect, it } from "vitest";

import { EXERCISES } from "@/lib/game/exercises";
import { GENERATED_EXERCISE_DESCRIPTIONS } from "@/lib/game/generated/puzzles.generated";
import { resolveExerciseDescription } from "@/lib/game/exercises";
import { CURATED_PIECES } from "@/lib/content/lint";

/**
 * A1 + A7 — the rook says what it teaches.
 *
 * The catalog knew each lesson only as `tags`, an internal taxonomy that never
 * reached the player. `GENERATED_EXERCISE_DESCRIPTIONS` was `{}`, so every row
 * fell through to the "Exercise {n}" fallback and a player captured a star with
 * no idea what for.
 *
 * The fallback stays in the code as a defence for uncurated pieces. For a
 * curated piece it must be UNREACHABLE — which is enforced twice: the linter
 * refuses to compile a curated exercise with no title (lib/content/lint.ts), and
 * this asserts the shipped catalog actually resolves real copy.
 */

const REQUIRED = ["principle", "title", "playerPrompt", "learningObjective"] as const;

describe("rook pedagogy", () => {
  it("is a curated piece", () => {
    expect(CURATED_PIECES).toContain("rook");
  });

  it("gives all ten exercises complete pedagogy", () => {
    expect(EXERCISES.rook).toHaveLength(10);
    for (const ex of EXERCISES.rook) {
      for (const field of REQUIRED) {
        expect(ex[field], `${ex.id} is missing ${field}`).toBeTruthy();
      }
    }
  });

  it("teaches one principle per exercise", () => {
    for (const ex of EXERCISES.rook) {
      expect(ex.principle).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });

  it("no longer ships an empty description map", () => {
    expect(Object.keys(GENERATED_EXERCISE_DESCRIPTIONS).length).toBeGreaterThan(0);
    for (const ex of EXERCISES.rook) {
      expect(GENERATED_EXERCISE_DESCRIPTIONS[ex.id]).toBe(ex.title);
    }
  });

  it("never falls back to 'Exercise N' for a rook exercise", () => {
    // Exactly the resolution the drawer performs, fallback included. If a title
    // ever goes missing, this reads the fallback back out and fails.
    EXERCISES.rook.forEach((ex, index) => {
      const resolved = resolveExerciseDescription(
        ex.id,
        index,
        () => null, // no i18n entry — the drawer's own path for generated ids
        (n) => `Exercise ${n}`,
      );
      expect(resolved).not.toMatch(/^Exercise \d+$/);
      expect(resolved).toBe(ex.title);
    });
  });

  it("teaches each principle exactly once", () => {
    // rook-3 repeated rook-2's file movement and rook-5 repeated rook-4's corner
    // turn. Two of ten slots taught nothing new while variable-distance and
    // no-diagonal went untaught. A duplicate here means a slot is being wasted.
    const principles = EXERCISES.rook.map((ex) => ex.principle);
    expect(new Set(principles).size).toBe(principles.length);
  });

  it("retires the replaced exercises rather than reusing their ids", () => {
    // Keeping an id would technically preserve progress — and that is exactly the
    // trap. A player holding 3 stars on `rook-3` earned them on "move down a
    // file"; the slot now teaches variable distance. Reusing the id would mark a
    // lesson complete that the player never saw. New content gets a new id, and
    // the orphaned entries drop out of the pool on load.
    const ids = EXERCISES.rook.map((ex) => ex.id);
    expect(ids).not.toContain("rook-3");
    expect(ids).not.toContain("rook-5");
    expect(ids).toContain("rook-distance-1");
    expect(ids).toContain("rook-no-diagonal-1");
  });

  it("walks the curriculum in order (A6)", () => {
    // move -> distinguish -> restrict -> plan. Each principle is introduced clean
    // and then escalated: no-diagonal in two moves (4) before its boxed form in
    // four (8); a single blocker (6) before a shut file (7) before a maze (9, 10).
    // Mastery is the ramp, not just the list of principles.
    expect(EXERCISES.rook.map((e) => e.id)).toEqual([
      "rook-1",              // move along the rank
      "rook-2",              // move along the file
      "rook-distance-1",     // one square is a move too
      "rook-no-diagonal-1",  // the rook is not a bishop
      "rook-4",              // turn the corner
      "rook-9",              // your own piece blocks the way
      "rook-10",             // the file is closed
      "rook-8",              // the boxed star
      "rook-6",              // find the shortest route
      "rook-7",              // plan the whole route
    ]);
  });

  it("ramps difficulty without a spike", () => {
    const optimals = EXERCISES.rook.map((ex) => ex.optimalMoves);
    expect(optimals).toEqual([1, 1, 1, 2, 2, 3, 4, 4, 3, 4]);
    // Obstacles rise monotonically once they appear — the clutter never jumps the
    // way it used to (0 straight to 21).
    const obstacles = EXERCISES.rook.map((ex) => ex.obstacles?.length ?? 0);
    expect(obstacles).toEqual([0, 0, 0, 0, 0, 2, 4, 2, 7, 11]);
  });

  it("keeps the trimmed exercises' decision intact (A5)", () => {
    // rook-6 shipped 21 blockers and rook-7 shipped 14, most of them scenery. The
    // trim is pinned to the DECISION, not to the blocker count: same optimal, same
    // number of optimal routes, same first-move width as the boards they replace.
    //
    // Peeled by optimalMoves alone, rook-6 would collapse to a single blocker —
    // still a 3-move detour, but its optimal routes go 2 -> 7 and its first move
    // widens from 8 choices to 11. That is a cheaper board, not the same lesson.
    const rook6 = EXERCISES.rook.find((e) => e.id === "rook-6");
    const rook7 = EXERCISES.rook.find((e) => e.id === "rook-7");

    expect(rook6?.optimalMoves).toBe(3);
    expect(rook6?.obstacles).toHaveLength(7); // was 21
    expect(rook7?.optimalMoves).toBe(4);
    expect(rook7?.obstacles).toHaveLength(11); // was 14
  });

  it("states the principle in the prompt, never the solution", () => {
    // A prompt that names squares is a walkthrough, not a lesson.
    for (const ex of EXERCISES.rook) {
      expect(ex.playerPrompt, `${ex.id} spells out coordinates`).not.toMatch(
        /\b[a-h][1-8]\b/,
      );
    }
  });
});
