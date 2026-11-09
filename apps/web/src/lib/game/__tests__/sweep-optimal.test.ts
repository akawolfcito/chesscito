import { describe, expect, it } from "vitest";

import { computeExerciseBfs } from "@/lib/game/exercise-bfs";
import { computeSweepOptimal } from "@/lib/game/sweep-optimal";
import type { BoardPosition, Exercise } from "@/lib/game/types";

const at = (file: number, rank: number): BoardPosition => ({ file, rank });

const rook = (over: Partial<Exercise> = {}): Exercise => ({
  id: "rook-sweep",
  startPos: at(0, 0), // a1
  targetPos: at(7, 0),
  optimalMoves: 0,
  ...over,
});

describe("computeSweepOptimal", () => {
  it("agrees with the single-target BFS when there is one target", () => {
    const ex = rook({ startPos: at(1, 3), targetPos: at(7, 3) });
    const bfs = computeExerciseBfs("rook", ex);
    expect(computeSweepOptimal("rook", ex)).toBe(bfs?.optimalMoves);
  });

  it("counts a straight sweep along one rank as one move per target", () => {
    // a1 → c1 → e1 → g1: the rook stops on each star, so three moves.
    const ex = rook({
      startPos: at(0, 0),
      targetPos: at(2, 0),
      targets: [at(2, 0), at(4, 0), at(6, 0)],
    });
    expect(computeSweepOptimal("rook", ex)).toBe(3);
  });

  it("picks the cheapest ORDER, not the authored order", () => {
    // The three corners a8, h1, h8 from a1. Walking the authored order costs
    // a1→a8 (1) + a8→h1 (2, no shared rank or file) + h1→h8 (1) = 4, while the
    // best order tours the rim for 3. This is the whole point of the level:
    // choosing the route. (Targets sharing one rank would make every order cost
    // the same and the assertion would be vacuous.)
    const authored = rook({
      startPos: at(0, 0),
      targetPos: at(0, 7),
      targets: [at(0, 7), at(7, 0), at(7, 7)],
    });
    const optimal = computeSweepOptimal("rook", authored);

    // Cost of obeying the authored order, leg by leg, with the same BFS.
    let authoredCost = 0;
    let from = authored.startPos;
    for (const t of authored.targets ?? []) {
      authoredCost += computeExerciseBfs("rook", {
        ...authored,
        startPos: from,
        targetPos: t,
      })!.optimalMoves;
      from = t;
    }

    expect(authoredCost).toBe(4);
    expect(optimal).toBeLessThan(authoredCost);
    expect(optimal).toBe(3); // a1→a8→h8→h1
  });

  it("returns null when a target is unreachable", () => {
    // Box the rook in with friendly blockers: it cannot leave a1.
    const ex = rook({
      startPos: at(0, 0),
      targetPos: at(7, 7),
      targets: [at(7, 7), at(3, 3)],
      obstacles: [at(1, 0), at(0, 1)],
    });
    expect(computeSweepOptimal("rook", ex)).toBeNull();
  });

  it("is independent of the order the targets are authored in", () => {
    const targets = [at(2, 0), at(4, 4), at(6, 2)];
    const base = rook({ startPos: at(0, 0), targetPos: targets[0] });
    const forward = computeSweepOptimal("rook", { ...base, targets });
    const reversed = computeSweepOptimal("rook", {
      ...base,
      targets: [...targets].reverse(),
    });
    expect(forward).toBe(reversed);
  });

  it("refuses the pawn, whose legs are not independent", () => {
    // A pawn never retreats, so collecting one target can strand another: the
    // shortest route is NOT the sum of pairwise shortest paths. Returning a
    // plausible number here would make the perfect run unreachable and the whole
    // experiment would measure a lie.
    const ex = rook({
      startPos: at(0, 1),
      targetPos: at(0, 4),
      targets: [at(0, 4), at(0, 2)],
    });
    expect(() => computeSweepOptimal("pawn", ex)).toThrow(/pawn/i);
  });
});
