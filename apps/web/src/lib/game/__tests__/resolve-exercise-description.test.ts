import { describe, expect, it, vi } from "vitest";

// Mock the generated module so the helper resolves against a known map,
// independent of whatever the real importer produced.
vi.mock("@/lib/game/generated/puzzles.generated", () => ({
  GENERATED_EXERCISES: {
    rook: [],
    bishop: [],
    knight: [],
    pawn: [],
    queen: [],
    king: [],
  },
  GENERATED_LABYRINTHS: {
    rook: [],
    bishop: [],
    knight: [],
    pawn: [],
    queen: [],
    king: [],
  },
  GENERATED_EXERCISE_DESCRIPTIONS: {
    "bishop-gen-test": "Take the long diagonal to h6.",
  },
}));

import { resolveExerciseDescription } from "@/lib/game/exercises";

describe("resolveExerciseDescription", () => {
  const fallback = (n: number) => `Exercise ${n}`;

  it("returns the generated description for a generated id", () => {
    const i18n = vi.fn(() => "should-not-be-called");
    const out = resolveExerciseDescription("bishop-gen-test", 7, i18n, fallback);
    expect(out).toBe("Take the long diagonal to h6.");
    expect(i18n).not.toHaveBeenCalled();
  });

  it("returns the i18n value for a hand-authored id", () => {
    const i18n = (id: string) => `i18n:${id}`;
    const out = resolveExerciseDescription("rook-1", 0, i18n, fallback);
    expect(out).toBe("i18n:rook-1");
  });

  it("returns the generic fallback when i18n returns null for an unknown id", () => {
    // The drawer guards with `descriptions.has(id)` and passes null when the
    // id has no translation, so no missing-message warning is ever emitted.
    const i18n = vi.fn(() => null);
    const out = resolveExerciseDescription("unknown-id", 4, i18n, fallback);
    expect(out).toBe("Exercise 5"); // index + 1
    expect(i18n).toHaveBeenCalledWith("unknown-id");
  });

  it("treats an empty i18n string as absent and uses the fallback", () => {
    const i18n = () => "";
    const out = resolveExerciseDescription("blank-id", 0, i18n, fallback);
    expect(out).toBe("Exercise 1");
  });
});
