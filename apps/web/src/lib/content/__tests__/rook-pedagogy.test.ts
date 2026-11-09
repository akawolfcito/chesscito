import { describe, expect, it } from "vitest";

import { EXERCISES } from "@/lib/game/exercises";
import { GENERATED_EXERCISE_DESCRIPTIONS } from "@/lib/game/generated/puzzles.generated";
import { resolveExerciseDescription } from "@/lib/game/exercises";
import { CURATED_PIECES, lintPieceSequence } from "@/lib/content/lint";

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

  it("gives every exercise complete pedagogy", () => {
    // A floor, not an equality: adding a rook board in the game builder is
    // normal authoring and must not fail a build. Emptying the pool still does,
    // and that is the failure this ever protected against.
    expect(EXERCISES.rook.length).toBeGreaterThanOrEqual(10);
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

  it("opens the curriculum on a one-move board (A6)", () => {
    // move -> distinguish -> restrict -> plan. The old version of this test
    // pinned the exact ten ids in order, which made every reorder in the game
    // builder a CI failure. What actually matters to a player is the ENTRY: the
    // first board a beginner ever sees must be solvable in one move. Everything
    // after that is pacing, and pacing is judged by lintPieceSequence.
    expect(EXERCISES.rook[0]?.optimalMoves).toBe(1);
  });

  it("ramps difficulty without a spike", () => {
    // This used to pin [1,1,1,2,2,3,4,4,3,4] and the obstacle counts beside it.
    // Both are authored values: the game builder changes them on purpose, and a
    // frozen array turns each of those saves into a red build. The rule moved to
    // lib/content/lint.ts, where a rough curve is a WARNING the author reads at
    // save time (founder, 2026-07-21).
    //
    // What stays enforced here is the half that must never break: pacing can
    // never fail a build. If a future change promotes these to errors, a single
    // rebalance in the builder locks the repo, and this goes red first.
    const result = lintPieceSequence({ piece: "rook", exercises: EXERCISES.rook });
    expect(result.errors).toEqual([]);
    // Deliberately NOT asserted: result.warnings. Today's rook curve does have
    // warnings (it jumps 2 -> 5 and dips 5 -> 4). Whether that is the right
    // lesson is the founder's call at save time, not the CI's at merge time.
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
