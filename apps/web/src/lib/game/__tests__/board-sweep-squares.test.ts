/**
 * `buildSquares` with several goal squares.
 *
 * The board has to SHOW every star at once and dim the ones already taken — a
 * sweep where only one star is visible is the flat exercise with extra steps.
 */
import { describe, expect, it } from "vitest";

import { buildBoardSquares } from "@/lib/game/board";
import { sweepTargetKey } from "@/lib/game/targets";
import type { BoardPiece, BoardPosition, SquareState } from "@/lib/game/types";

const at = (file: number, rank: number): BoardPosition => ({ file, rank });

const piece: BoardPiece = { id: "p", type: "rook", position: at(4, 1) };

type BuildArgs = Parameters<typeof buildBoardSquares>[0];

const build = (over: Omit<BuildArgs, "selectedPosition" | "piece" | "validTargets">) =>
  buildBoardSquares({ selectedPosition: null, piece, validTargets: [], ...over });

const squareAt = (squares: SquareState[], p: BoardPosition) =>
  squares.find((s) => s.file === p.file && s.rank === p.rank)!;

const E8 = at(4, 7);
const B8 = at(1, 7);
const B4 = at(1, 3);

describe("buildSquares — single target (unchanged)", () => {
  it("marks exactly one square", () => {
    const squares = build({ targetPosition: E8 });
    expect(squareAt(squares, E8).isTarget).toBe(true);
    expect(squares.filter((s) => s.isTarget)).toHaveLength(1);
  });

  it("reports nothing as collected", () => {
    const squares = build({ targetPosition: E8 });
    expect(squareAt(squares, E8).isCollectedTarget).toBe(false);
  });
});

describe("buildSquares — sweep", () => {
  it("marks EVERY uncollected target", () => {
    const squares = build({ targetPosition: E8, targetPositions: [E8, B8, B4] });
    expect(squares.filter((s) => s.isTarget)).toHaveLength(3);
    for (const p of [E8, B8, B4]) expect(squareAt(squares, p).isTarget).toBe(true);
  });

  it("moves a collected target from `isTarget` to `isCollectedTarget`", () => {
    const squares = build({
      targetPosition: E8,
      targetPositions: [E8, B8, B4],
      collectedTargetKeys: new Set([sweepTargetKey(B8)]),
    });
    expect(squareAt(squares, B8).isTarget).toBe(false);
    expect(squareAt(squares, B8).isCollectedTarget).toBe(true);
    // The other two are still live.
    expect(squareAt(squares, E8).isTarget).toBe(true);
    expect(squareAt(squares, B4).isTarget).toBe(true);
    expect(squares.filter((s) => s.isTarget)).toHaveLength(2);
  });

  it("does not mark targets[0] specially", () => {
    // `targetPos` is targets[0] for compatibility only; the player must not see
    // one star as more important than the others.
    const squares = build({ targetPosition: E8, targetPositions: [E8, B8, B4] });
    const marked = squares.filter((s) => s.isTarget).map((s) => s.label);
    expect(marked).toHaveLength(3);
    expect(new Set(marked).size).toBe(3);
  });

  it("leaves every non-target square alone", () => {
    const squares = build({ targetPosition: E8, targetPositions: [E8, B8, B4] });
    expect(squareAt(squares, at(0, 0)).isTarget).toBe(false);
    expect(squareAt(squares, at(0, 0)).isCollectedTarget).toBe(false);
  });

  it("ignores a collected key that is not a target", () => {
    const squares = build({
      targetPosition: E8,
      targetPositions: [E8, B8],
      collectedTargetKeys: new Set([sweepTargetKey(at(7, 0))]),
    });
    expect(squares.filter((s) => s.isTarget)).toHaveLength(2);
    expect(squares.filter((s) => s.isCollectedTarget)).toHaveLength(0);
  });
});
