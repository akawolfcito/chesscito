import { describe, expect, it } from "vitest";
import {
  reachablePivots,
  resolvePivot,
  pivotBfs,
} from "@/lib/game/diagonal-run";
import type { BoardPosition } from "@/lib/game/types";

const P = (sq: string): BoardPosition => ({
  file: "abcdefgh".indexOf(sq[0]),
  rank: Number(sq[1]) - 1,
});
const labels = (ps: BoardPosition[]) =>
  ps.map((p) => `${"abcdefgh"[p.file]}${p.rank + 1}`).sort();
const G1 = P("g1");
const E5 = [P("e5")];

/**
 * Diagonal Run pivot model (Gate D2, corrected). Spike level: a1 → g1 with a
 * friendly knight on e5. The winning tap is the pivot d4 (turn SE reaches g1) →
 * optimalMoves 1.
 */
describe("reachablePivots", () => {
  it("lists the clear-diagonal squares, stopping before a blocker", () => {
    // a1 corner, NE ray blocked at e5 → b2, c3, d4 only.
    expect(labels(reachablePivots(P("a1"), E5))).toEqual(["b2", "c3", "d4"]);
  });
});

describe("resolvePivot", () => {
  it("wins when the pivot's perpendicular turn reaches the star", () => {
    const r = resolvePivot(P("a1"), P("d4"), E5, G1);
    expect(r.outcome).toBe("win");
    if (r.outcome === "win") expect(r.landing).toEqual(G1); // d4 → SE → g1
  });

  it("captures directly when the tapped square IS the star", () => {
    // From d4 the star g1 is one clear diagonal away — tapping it captures.
    const r = resolvePivot(P("d4"), G1, E5, G1);
    expect(r.outcome).toBe("win");
  });

  it("rejects a square that is not a reachable diagonal move", () => {
    expect(resolvePivot(P("a1"), P("a5"), E5, G1).outcome).toBe("illegal"); // not diagonal
    expect(resolvePivot(P("a1"), P("f6"), E5, G1).outcome).toBe("illegal"); // past the e5 blocker
    expect(resolvePivot(P("a1"), P("a1"), E5, G1).outcome).toBe("illegal"); // same square
  });

  it("turns and slides to a heuristic landing when no turn reaches the star", () => {
    // From b2 the perpendicular exits land on a3 and c1; c1 is closer to g1.
    const r = resolvePivot(P("a1"), P("b2"), E5, G1);
    expect(r.outcome).toBe("move");
    if (r.outcome === "move") expect(r.landing).toEqual(P("c1"));
  });

  it("never continues straight through the pivot (turns only)", () => {
    // b2 exits are the two PERPENDICULAR diagonals (a3 / c1), never forward to
    // c3/d4 nor back to a1.
    const r = resolvePivot(P("a1"), P("b2"), E5, G1);
    if (r.outcome === "move") {
      expect(["c1", "a3"]).toContain(
        `${"abcdefgh"[r.landing.file]}${r.landing.rank + 1}`,
      );
    }
  });
});

describe("pivotBfs", () => {
  it("solves the spike level in one tap (pivot d4)", () => {
    expect(pivotBfs(P("a1"), G1, E5)).toEqual({ reachable: true, optimalMoves: 1 });
  });

  it("reports reachability from an arbitrary position", () => {
    expect(pivotBfs(P("a1"), G1, E5).reachable).toBe(true);
  });
});
