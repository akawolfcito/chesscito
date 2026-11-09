/**
 * The replay CTA's semantics, pinned before any pixel exists.
 *
 * The promise is "beat your RECORD", not "fix this run" — so every number the
 * player sees is derived from the best, never from the attempt just played.
 */
import { describe, expect, it } from "vitest";

import { toSweepResultPresentation } from "@/lib/game/sweep-result-cta";
import type { BoardPosition, Exercise } from "@/lib/game/types";

const at = (file: number, rank: number): BoardPosition => ({ file, rank });

const sweep = (over: Partial<Exercise> = {}): Exercise => ({
  id: "rook-2",
  startPos: at(4, 1),
  targetPos: at(4, 7),
  optimalMoves: 7,
  targets: [at(4, 7), at(1, 7), at(1, 3)],
  ...over,
});

const plain = (): Exercise => ({
  id: "rook-1",
  startPos: at(1, 3),
  targetPos: at(7, 3),
  optimalMoves: 1,
});

describe("the founder's two anchored cases", () => {
  it("a WORSE run keeps the old best and its gap (10 played, 9 best, 7 optimal)", () => {
    const p = toSweepResultPresentation({
      exercise: sweep({ optimalMoves: 7 }),
      runMoves: 10,
      previousBest: 9,
    });
    expect(p.bestMoves).toBe(9);
    expect(p.optimalMoves).toBe(7);
    // ⛔ NOT 3. The gap is measured from the record, not from this execution.
    expect(p.gapToPerfect).toBe(2);
    expect(p.isPerfect).toBe(false);
    expect(p.showReplayCta).toBe(true);
  });

  it("a PERFECT run takes the record and drops the CTA (7 played, 9 best, 7 optimal)", () => {
    const p = toSweepResultPresentation({
      exercise: sweep({ optimalMoves: 7 }),
      runMoves: 7,
      previousBest: 9,
    });
    expect(p.bestMoves).toBe(7);
    expect(p.isPerfect).toBe(true);
    expect(p.gapToPerfect).toBe(0);
    // Inviting someone to beat the unbeatable is the kind of number a player
    // reads as a lie.
    expect(p.showReplayCta).toBe(false);
  });
});

describe("best resolution", () => {
  it("uses this run when there is no previous best", () => {
    const p = toSweepResultPresentation({
      exercise: sweep(),
      runMoves: 10,
      previousBest: undefined,
    });
    expect(p.bestMoves).toBe(10);
    expect(p.gapToPerfect).toBe(3);
    expect(p.showReplayCta).toBe(true);
  });

  it("takes the better of the two", () => {
    const args = { exercise: sweep(), previousBest: 9 };
    expect(toSweepResultPresentation({ ...args, runMoves: 8 }).bestMoves).toBe(8);
    expect(toSweepResultPresentation({ ...args, runMoves: 12 }).bestMoves).toBe(9);
  });

  it("treats a tie as no improvement but keeps the same promise", () => {
    const p = toSweepResultPresentation({
      exercise: sweep(),
      runMoves: 9,
      previousBest: 9,
    });
    expect(p.bestMoves).toBe(9);
    expect(p.gapToPerfect).toBe(2);
    expect(p.showReplayCta).toBe(true);
  });

  it("never reports a negative gap", () => {
    // A best below the declared optimum would mean the optimum is wrong; the CTA
    // must not render "te faltan -1" while someone investigates.
    const p = toSweepResultPresentation({
      exercise: sweep({ optimalMoves: 7 }),
      runMoves: 5,
      previousBest: undefined,
    });
    expect(p.gapToPerfect).toBe(0);
    expect(p.isPerfect).toBe(true);
    expect(p.showReplayCta).toBe(false);
  });
});

describe("the counter is a PRESENTATION decision, not a game rule", () => {
  it("shows for a real sweep", () => {
    const p = toSweepResultPresentation({
      exercise: sweep(),
      runMoves: 9,
      previousBest: undefined,
    });
    expect(p.showCounter).toBe(true);
    expect(p.totalTargets).toBe(3);
  });

  it("stays hidden on a legacy single-target exercise", () => {
    // The machine treats it as a one-target sweep; the UX has no business
    // printing "1/1" across the whole product.
    const p = toSweepResultPresentation({
      exercise: plain(),
      runMoves: 3,
      previousBest: undefined,
    });
    expect(p.showCounter).toBe(false);
    expect(p.totalTargets).toBe(1);
  });

  it("still reports a best and a gap on a legacy exercise", () => {
    // Hiding the counter must not hide the record: the numbers are independent
    // of whether the board has one star or four.
    const p = toSweepResultPresentation({
      exercise: plain(),
      runMoves: 3,
      previousBest: undefined,
    });
    expect(p.bestMoves).toBe(3);
    expect(p.optimalMoves).toBe(1);
    expect(p.gapToPerfect).toBe(2);
  });
});
