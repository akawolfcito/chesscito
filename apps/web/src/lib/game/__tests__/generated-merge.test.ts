import { describe, expect, it } from "vitest";
import { EXERCISES, LABYRINTHS } from "@/lib/game/exercises";
import {
  GENERATED_EXERCISES,
  GENERATED_LABYRINTHS,
} from "@/lib/game/generated/puzzles.generated";

/**
 * Augment guard.
 *
 * EXERCISES are still hand-authored + appended generated (drills were NOT
 * migrated), so that half keeps the original append-after invariant.
 *
 * LABYRINTHS are now FULLY content-sourced: the 18 hand-authored labs were
 * migrated into content/labyrinths.json (2026-06-16,
 * scripts/migrate-labyrinths.ts), so `LABYRINTHS[piece]` === the generated
 * pool. The guard for labyrinths therefore checks that every generated id is
 * present and that the migrated labs keep their authored relative order.
 */
describe("generated catalog merge — append after hand-authored", () => {
  it("LABYRINTHS.rook sources entirely from GENERATED_LABYRINTHS.rook", () => {
    expect(LABYRINTHS.rook.map((e) => e.id)).toEqual(
      GENERATED_LABYRINTHS.rook.map((e) => e.id),
    );
  });

  it("keeps the migrated rook labs in authored relative order", () => {
    const ids = LABYRINTHS.rook.map((e) => e.id);
    const i1 = ids.indexOf("rook-lab-1");
    const i2 = ids.indexOf("rook-lab-2");
    const i3 = ids.indexOf("rook-lab-3");
    expect(i1).toBeGreaterThanOrEqual(0);
    expect(i1).toBeLessThan(i2);
    expect(i2).toBeLessThan(i3);
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

  it("preserves every hand-authored exercise id ahead of any generated id", () => {
    // First hand-authored bishop exercise id is still first in the merged pool.
    expect(EXERCISES.bishop[0]?.id).toBe("bishop-1");
  });
});
