import { describe, expect, it } from "vitest";
import {
  reachableSquares,
  legalTourMoves,
  isTourStuck,
} from "@/lib/game/knight-tour";
import type { BoardPosition } from "@/lib/game/types";

const P = (sq: string): BoardPosition => ({
  file: "abcdefgh".indexOf(sq[0]),
  rank: Number(sq[1]) - 1,
});
const labels = (ps: BoardPosition[]) =>
  ps.map((p) => `${"abcdefgh"[p.file]}${p.rank + 1}`).sort();
const at = (...sqs: string[]) => sqs.map(P);

/**
 * Knight's Tour (spec 2026-07-16 §1). The knight leaves an X on every square it
 * vacates and can never re-enter one; the run ends when no legal unvisited
 * square remains. Score = visited ÷ reachable, so the reachable set — walls
 * included — is what the level's ceiling is measured against.
 *
 * POCKET: with walls on c2/c1/d2/d4/a5/c5 a knight on a1 can only ever touch
 * a1 and b3. Two squares, and the second one dead-ends back into the first.
 */
const POCKET = at("c2", "c1", "d2", "d4", "a5", "c5");

describe("legalTourMoves", () => {
  it("lists the knight's jumps on an open board", () => {
    expect(labels(legalTourMoves(P("a1"), [], []))).toEqual(["b3", "c2"]);
  });

  it("never re-enters a visited (X) square", () => {
    expect(labels(legalTourMoves(P("a1"), at("b3"), []))).toEqual(["c2"]);
  });

  it("never lands on a wall", () => {
    expect(labels(legalTourMoves(P("a1"), [], at("c2")))).toEqual(["b3"]);
  });
});

describe("reachableSquares", () => {
  it("counts the whole board from a corner when nothing blocks", () => {
    // A knight on an open 8x8 reaches every square; the ceiling is all 64.
    expect(reachableSquares(P("a1"), [])).toHaveLength(64);
  });

  it("includes the start square itself", () => {
    expect(labels(reachableSquares(P("a1"), POCKET))).toContain("a1");
  });

  it("stops at the walls that seal a pocket", () => {
    expect(labels(reachableSquares(P("a1"), POCKET))).toEqual(["a1", "b3"]);
  });

  it("returns the lone start square when every jump is walled", () => {
    expect(labels(reachableSquares(P("a1"), at("b3", "c2")))).toEqual(["a1"]);
  });
});

describe("isTourStuck", () => {
  it("is false while an unvisited square is still in reach", () => {
    expect(isTourStuck(P("a1"), at("a1"), POCKET)).toBe(false);
  });

  it("is true once every reachable square carries an X", () => {
    // a1 -> b3 completes this pocket: b3's only exit is a1, already visited.
    expect(isTourStuck(P("b3"), at("a1", "b3"), POCKET)).toBe(true);
  });
});
