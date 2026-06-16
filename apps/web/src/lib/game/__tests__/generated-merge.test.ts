import { describe, expect, it } from "vitest";
import { EXERCISES, LABYRINTHS } from "@/lib/game/exercises";
import {
  GENERATED_EXERCISES,
  GENERATED_LABYRINTHS,
} from "@/lib/game/generated/puzzles.generated";

/**
 * Content-source guard.
 *
 * Both EXERCISES and LABYRINTHS are now FULLY content-sourced: the 60
 * hand-authored exercises (2026-06-16, scripts/migrate-exercises.ts) and the
 * 18 hand-authored labs (scripts/migrate-labyrinths.ts) were migrated into
 * content/exercises.json + content/labyrinths.json, so `EXERCISES[piece]` ===
 * the generated exercise pool and `LABYRINTHS[piece]` === the generated lab
 * pool. The guard checks that every generated id is present and that the
 * migrated entries keep their authored relative order (order = original index).
 */
describe("generated catalog — fully content-sourced", () => {
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

  it("EXERCISES.bishop sources entirely from GENERATED_EXERCISES.bishop", () => {
    expect(EXERCISES.bishop.map((e) => e.id)).toEqual(
      GENERATED_EXERCISES.bishop.map((e) => e.id),
    );
  });

  it("keeps the migrated bishop exercises in authored relative order", () => {
    // order = original catalog index, so the wave-1 ids stay in sequence.
    const ids = EXERCISES.bishop.map((e) => e.id);
    expect(ids[0]).toBe("bishop-1");
    expect(ids.indexOf("bishop-1")).toBeLessThan(ids.indexOf("bishop-2"));
    expect(ids.indexOf("bishop-9")).toBeLessThan(ids.indexOf("bishop-10"));
  });
});
