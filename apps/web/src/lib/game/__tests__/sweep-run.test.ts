import { describe, expect, it } from "vitest";

import { collectAt, startSweepRun } from "@/lib/game/sweep-run";
import type { BoardPosition, Exercise } from "@/lib/game/types";

const at = (file: number, rank: number): BoardPosition => ({ file, rank });

const E8 = at(4, 7);
const B8 = at(1, 7);
const B4 = at(1, 3);

const sweep = (over: Partial<Exercise> = {}): Exercise => ({
  id: "rook-2",
  startPos: at(4, 1),
  targetPos: E8,
  optimalMoves: 3,
  targets: [E8, B8, B4],
  ...over,
});

const plain = (): Exercise => ({
  id: "rook-1",
  startPos: at(1, 3),
  targetPos: at(7, 3),
  optimalMoves: 1,
});

/** Walk a sequence of landings and return the final state. */
const walk = (exercise: Exercise, path: BoardPosition[]) =>
  path.reduce((s, p) => collectAt(s, exercise, p), startSweepRun(exercise));

describe("startSweepRun", () => {
  it("starts with nothing collected and every target remaining", () => {
    const s = startSweepRun(sweep());
    expect(s.collectedCount).toBe(0);
    expect(s.totalCount).toBe(3);
    expect(s.remaining).toEqual([E8, B8, B4]);
    expect(s.isComplete).toBe(false);
  });

  it("treats a plain exercise as a one-target sweep", () => {
    // Same code path for both shapes: the screen must not branch on `isSweep`.
    const s = startSweepRun(plain());
    expect(s.totalCount).toBe(1);
    expect(s.isComplete).toBe(false);
  });
});

describe("collectAt — order is free", () => {
  it("completes only when the LAST target is collected", () => {
    const ex = sweep();
    const a = collectAt(startSweepRun(ex), ex, B8);
    expect(a.collectedCount).toBe(1);
    expect(a.isComplete).toBe(false);

    const b = collectAt(a, ex, B4);
    expect(b.collectedCount).toBe(2);
    expect(b.isComplete).toBe(false);

    const c = collectAt(b, ex, E8);
    expect(c.collectedCount).toBe(3);
    expect(c.isComplete).toBe(true);
  });

  it("accepts every permutation of the same three targets", () => {
    const ex = sweep();
    const orders: BoardPosition[][] = [
      [E8, B8, B4],
      [E8, B4, B8],
      [B8, E8, B4],
      [B8, B4, E8],
      [B4, E8, B8],
      [B4, B8, E8],
    ];
    for (const order of orders) {
      const s = walk(ex, order);
      expect(s.isComplete).toBe(true);
      expect(s.collectedCount).toBe(3);
    }
  });

  it("does not complete early just because targets[0] was reached", () => {
    // The bug this whole stage exists to prevent: `targetPos` IS targets[0], so a
    // single-square win condition would end the level on the first star and hand
    // out three stars for one move.
    const ex = sweep();
    const s = collectAt(startSweepRun(ex), ex, E8);
    expect(s.isComplete).toBe(false);
    expect(s.remaining).toEqual([B8, B4]);
  });
});

describe("collectAt — deduplication", () => {
  it("ignores a target that was already collected", () => {
    const ex = sweep();
    const once = collectAt(startSweepRun(ex), ex, B8);
    const twice = collectAt(once, ex, B8);
    expect(twice.collectedCount).toBe(1);
    expect(twice.isComplete).toBe(false);
  });

  it("never completes from re-landing on collected squares", () => {
    // Three landings, one distinct target: a naive counter would call this done.
    const ex = sweep();
    const s = walk(ex, [B8, B8, B8]);
    expect(s.collectedCount).toBe(1);
    expect(s.isComplete).toBe(false);
  });

  it("returns the SAME state object when nothing changed", () => {
    // The screen re-renders off this; a fresh object on every non-collecting move
    // would restart effects that key on the run.
    const ex = sweep();
    const once = collectAt(startSweepRun(ex), ex, B8);
    expect(collectAt(once, ex, B8)).toBe(once);
    expect(collectAt(once, ex, at(7, 0))).toBe(once);
  });
});

describe("collectAt — squares that are not targets", () => {
  it("leaves the run untouched", () => {
    const ex = sweep();
    const s = walk(ex, [at(7, 0), at(0, 0), at(3, 3)]);
    expect(s.collectedCount).toBe(0);
    expect(s.isComplete).toBe(false);
  });

  it("counts a pass-through square only if it IS a target", () => {
    const ex = sweep();
    const s = walk(ex, [at(4, 4), B4]);
    expect(s.collectedCount).toBe(1);
  });
});

describe("collectAt — a completed run stays completed", () => {
  it("does not go backwards or double-count", () => {
    const ex = sweep();
    const done = walk(ex, [E8, B8, B4]);
    expect(done.isComplete).toBe(true);

    const after = collectAt(done, ex, B4);
    expect(after.isComplete).toBe(true);
    expect(after.collectedCount).toBe(3);
  });
});

describe("collectAt — plain exercises keep their behaviour", () => {
  it("completes on the single target", () => {
    const ex = plain();
    const s = collectAt(startSweepRun(ex), ex, ex.targetPos);
    expect(s.isComplete).toBe(true);
    expect(s.collectedCount).toBe(1);
  });

  it("does not complete anywhere else", () => {
    const ex = plain();
    const s = collectAt(startSweepRun(ex), ex, at(0, 0));
    expect(s.isComplete).toBe(false);
  });
});
