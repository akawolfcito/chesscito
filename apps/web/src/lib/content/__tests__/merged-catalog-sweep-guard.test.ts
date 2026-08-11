/**
 * An overlay row must never shadow a Star Sweep.
 *
 * THE INCIDENT THIS ENCODES (2026-08-11)
 * --------------------------------------
 * `content_overlay` in production carried rows for `rook-1`, `rook-2` and
 * `rook-distance-1`. The table has no `targets` column, so a row built from it
 * always has `targets: undefined` — and `mergeOverlay` replaced the baseline
 * entry wholesale, inheriting only the pedagogy fields. Result on device: the
 * board showed the NEW title ("Sweep the file") with ONE star, no counter, and
 * `optimalMoves: 1`.
 *
 * That last field is what made it dangerous rather than merely wrong: the screen
 * treats `optimalMoves === 1` as "any non-target move is an instant loss"
 * (`exercises-screen.tsx:2035`), so the level became unplayable AND failed the
 * player for trying — while every unit test and the whole suite stayed green,
 * because they all read the baseline.
 *
 * ⛔ The fix is NOT to inherit `targets` from the baseline. The overlay row may
 * carry a different FEN, mover or target, and grafting the baseline's goal
 * squares onto a different board yields a level nobody authored and nothing can
 * verify. An overlay row simply cannot express a sweep, so it is not a valid
 * override of one: the baseline wins and the row is reported.
 */
import { describe, expect, it } from "vitest";

import { getBaseline, mergeOverlay } from "@/lib/content/merged-catalog";
import { isSweep } from "@/lib/game/targets";

/** The shape production actually had for `rook-2`. */
const shadowRow = (over: Record<string, unknown> = {}) =>
  ({
    id: "rook-2",
    kind: "exercise",
    piece: "rook",
    fen: "8/8/8/8/8/8/4R3/8 w - - 0 1",
    target: "e8",
    mover: "e2",
    tier: "easy",
    tags: null,
    explanation: null,
    order: 1,
    disabled: false,
    optimal_moves: 1,
    updated_at: new Date().toISOString(),
    stage: "published",
    ...over,
  }) as Parameters<typeof mergeOverlay>[1][number];

const rook2Of = (cat: ReturnType<typeof mergeOverlay>) =>
  cat.exercises.rook.find((e) => e.id === "rook-2")!;

describe("the baseline this guards is really a sweep", () => {
  it("ships rook-2 with several targets", () => {
    // Guards the guard: if the content is ever reverted these tests would pass
    // vacuously and stop protecting anything.
    const baseline = getBaseline();
    const rook2 = baseline.exercises.rook.find((e) => e.id === "rook-2")!;
    expect(isSweep(rook2)).toBe(true);
    expect(rook2.optimalMoves).toBeGreaterThan(1);
  });
});

describe("mergeOverlay — a row cannot shadow a sweep", () => {
  it("keeps the baseline sweep instead of the overlay row", () => {
    const merged = mergeOverlay(getBaseline(), [shadowRow()]);
    const rook2 = rook2Of(merged);

    expect(isSweep(rook2)).toBe(true);
    expect(rook2.targets?.length).toBeGreaterThan(1);
  });

  it("keeps the sweep's computed optimum, not the row's 1", () => {
    // The field that turned a wrong level into an unplayable one.
    const merged = mergeOverlay(getBaseline(), [shadowRow()]);
    expect(rook2Of(merged).optimalMoves).toBeGreaterThan(1);
  });

  it("keeps the per-board star floor the row cannot express", () => {
    expect(rook2Of(mergeOverlay(getBaseline(), [shadowRow()])).starFloor).toBe(1);
  });

  it("does not count the skipped row as applied", () => {
    // Reporting it as applied would make the overlay's own diagnostics agree
    // with a merge that did not happen.
    const merged = mergeOverlay(getBaseline(), [shadowRow()]);
    expect(merged.overlayCount).toBe(0);
  });

  it("still applies overlay rows for NON-sweep exercises", () => {
    // The guard must be narrow: the builder's normal edits keep working.
    const merged = mergeOverlay(getBaseline(), [
      shadowRow({
        id: "rook-9",
        order: 5,
        fen: "8/8/8/8/8/8/4R3/8 w - - 0 1",
        target: "e8",
        mover: "e2",
        optimal_moves: 1,
      }),
    ]);
    const rook9 = merged.exercises.rook.find((e) => e.id === "rook-9")!;
    expect(rook9.optimalMoves).toBe(1);
    expect(merged.overlayCount).toBe(1);
  });

  it("still lets a row DISABLE a sweep", () => {
    // Retiring content is a decision the overlay is allowed to make; it is
    // expressing "not this one", not a broken version of it.
    const merged = mergeOverlay(getBaseline(), [shadowRow({ disabled: true })]);
    expect(merged.exercises.rook.some((e) => e.id === "rook-2")).toBe(false);
  });
});
