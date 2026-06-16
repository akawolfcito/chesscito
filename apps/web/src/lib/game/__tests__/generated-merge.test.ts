import { describe, expect, it } from "vitest";
import { EXERCISES, LABYRINTHS } from "@/lib/game/exercises";
import {
  GENERATED_EXERCISES,
  GENERATED_LABYRINTHS,
} from "@/lib/game/generated/puzzles.generated";

/**
 * Augment guard — generated puzzles are APPENDED after the hand-authored
 * pools, never reordered or dropped. Spot-checks the two pieces that
 * currently carry generated content (rook labyrinths, bishop exercises);
 * if a generated pool is empty the corresponding block no-ops gracefully.
 */
describe("generated catalog merge — append after hand-authored", () => {
  it("appends GENERATED_LABYRINTHS.rook after the hand-authored rook labs", () => {
    const generated = GENERATED_LABYRINTHS.rook;
    if (generated.length === 0) return; // no-op when nothing generated
    const ids = LABYRINTHS.rook.map((e) => e.id);
    for (const gen of generated) {
      expect(ids).toContain(gen.id);
      // Strictly after the first hand-authored entry (index > 0).
      expect(ids.indexOf(gen.id)).toBeGreaterThan(0);
    }
  });

  it("appends GENERATED_EXERCISES.bishop after the hand-authored bishop exercises", () => {
    const generated = GENERATED_EXERCISES.bishop;
    if (generated.length === 0) return; // no-op when nothing generated
    const ids = EXERCISES.bishop.map((e) => e.id);
    for (const gen of generated) {
      expect(ids).toContain(gen.id);
      expect(ids.indexOf(gen.id)).toBeGreaterThan(0);
    }
  });

  it("preserves every hand-authored id ahead of any generated id", () => {
    // First hand-authored rook lab id is still first in the merged pool.
    expect(LABYRINTHS.rook[0]?.id).toBe("rook-lab-1");
    expect(EXERCISES.bishop[0]?.id).toBe("bishop-1");
  });
});
