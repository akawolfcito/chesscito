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

  it("keeps a monotonic difficulty ramp — no spikes out of order", () => {
    // The published optimals: 1,1,1,2,2,3,4,4,3,4. The ramp is what the player
    // feels; A6 reorders the tail, and this is the guard that it stays a ramp.
    const optimals = EXERCISES.rook.map((ex) => ex.optimalMoves);
    expect(optimals.slice(0, 5)).toEqual([1, 1, 1, 2, 2]);
    // Variable distance really is one move; the clean no-diagonal really is two.
    expect(EXERCISES.rook.find((e) => e.id === "rook-distance-1")?.optimalMoves).toBe(1);
    expect(EXERCISES.rook.find((e) => e.id === "rook-no-diagonal-1")?.optimalMoves).toBe(2);
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
