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

  it("keeps the Rook Rails ladder in its authored order", () => {
    // The ladder is a curriculum: Two Turns → Dead End → Two Roads → Rook Run,
    // easiest first. `order` (0..3) pins it, and the sequence must survive the
    // catalog round-trip.
    const ids = LABYRINTHS.rook.map((e) => e.id);
    expect(ids).toEqual([
      "rook-rail-two-turns",
      "rook-rail-dead-end",
      "rook-rail-two-roads",
      "rook-rail-rook-run",
    ]);
  });

  it("EXERCISES.bishop sources entirely from GENERATED_EXERCISES.bishop", () => {
    expect(EXERCISES.bishop.map((e) => e.id)).toEqual(
      GENERATED_EXERCISES.bishop.map((e) => e.id),
    );
  });

  it("ships the curated bishop curriculum, opening on bishop-1 and without bishop-9", () => {
    // Was: the exact nine ids, in order. That pinned AUTHORED content — the
    // curriculum was rebuilt on 2026-08-11 (sweeps + two dense boards) and every
    // id after the first moved, which is a reorder the author is allowed to make.
    // What must never move: the entry board, and the retirement of bishop-9 (a
    // duplicate of bishop-8 mislabelled "capture").
    const ids = EXERCISES.bishop.map((e) => e.id);
    expect(ids[0]).toBe("bishop-1");
    expect(new Set(ids).size, "duplicate bishop id").toBe(ids.length);
    expect(ids).not.toContain("bishop-9");
  });
});
