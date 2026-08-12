/**
 * An overlay row without `targets` must never shadow a Star Sweep.
 *
 * ⚠️ The rule NARROWED on 2026-08-11 (sweeps-in-the-builder): `content_overlay`
 * now has a `targets` column, so a row CAN express a multi-goal board and is a
 * valid override of one. What stays forbidden is the degradation — a one-goal
 * row landing on a multi-goal baseline — which is the incident below.
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
    //
    // ⚠️ The id is DERIVED, not written out. It was the literal `rook-9`, and the
    // day that board was converted to a sweep in the builder this test failed —
    // claiming the narrow guard was broken when all that had changed was which
    // board the founder picked. Authored content is not a fixture.
    const plainId = getBaseline().exercises.rook.find((e) => !isSweep(e))!.id;
    const merged = mergeOverlay(getBaseline(), [
      shadowRow({
        id: plainId,
        order: 5,
        fen: "8/8/8/8/8/8/4R3/8 w - - 0 1",
        target: "e8",
        mover: "e2",
        optimal_moves: 1,
      }),
    ]);
    const edited = merged.exercises.rook.find((e) => e.id === plainId)!;
    expect(edited.optimalMoves).toBe(1);
    expect(merged.overlayCount).toBe(1);
  });

  it("still lets a row DISABLE a sweep", () => {
    // Retiring content is a decision the overlay is allowed to make; it is
    // expressing "not this one", not a broken version of it.
    const merged = mergeOverlay(getBaseline(), [shadowRow({ disabled: true })]);
    expect(merged.exercises.rook.some((e) => e.id === "rook-2")).toBe(false);
  });
});

/** The same board carrying its stars: a1 -> a8 -> h1 is 3, the leg to a8 is 1. */
const sweepRow = (over: Record<string, unknown> = {}) =>
  shadowRow({
    fen: "8/8/8/8/8/8/8/R7 w - - 0 1",
    mover: "a1",
    target: "a8",
    targets: ["a8", "h1"],
    optimal_moves: 3,
    ...over,
  });

describe("mergeOverlay — a row WITH targets is a valid override", () => {
  it("applies it, sweep and all", () => {
    const merged = mergeOverlay(getBaseline(), [sweepRow()]);
    const rook2 = rook2Of(merged);

    expect(isSweep(rook2)).toBe(true);
    expect(rook2.targets).toHaveLength(2);
    expect(rook2.optimalMoves).toBe(3);
    expect(merged.overlayCount).toBe(1);
    expect(merged.skippedSweepOverrides).toEqual([]);
  });

  it("carries the row's own star floor", () => {
    const merged = mergeOverlay(getBaseline(), [sweepRow({ star_floor: 2 })]);
    expect(rook2Of(merged).starFloor).toBe(2);
  });

  it("drops a row whose stored optimum disagrees with the ORDER optimum", () => {
    // Trust-but-verify, and the number that matters most: `optimal_moves` is the
    // denominator the grader divides by. A row claiming the leg's 1 would make
    // every completed run perfect — the same field that made the 2026-08-11
    // incident unplayable rather than merely wrong.
    const merged = mergeOverlay(getBaseline(), [sweepRow({ optimal_moves: 1 })]);

    expect(rook2Of(merged).optimalMoves).toBeGreaterThan(1);
    expect(merged.overlayCount).toBe(0);
  });

  it("creates a brand-new sweep the baseline never had", () => {
    const merged = mergeOverlay(getBaseline(), [
      sweepRow({ id: "rook-overlay-new-sweep", order: 99 }),
    ]);
    const created = merged.exercises.rook.find(
      (e) => e.id === "rook-overlay-new-sweep",
    )!;

    expect(created).toBeDefined();
    expect(isSweep(created)).toBe(true);
    expect(created.optimalMoves).toBe(3);
  });
});
