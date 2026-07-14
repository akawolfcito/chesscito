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

  it("states the principle in the prompt, never the solution", () => {
    // A prompt that names squares is a walkthrough, not a lesson.
    for (const ex of EXERCISES.rook) {
      expect(ex.playerPrompt, `${ex.id} spells out coordinates`).not.toMatch(
        /\b[a-h][1-8]\b/,
      );
    }
  });
});
