import { describe, expect, it } from "vitest";

import {
  isCaught,
  legalKingSteps,
  safePathOptimalMoves,
} from "@/lib/game/safe-path";
import { squareToPos, type TypedEnemy } from "@/lib/game/fen-puzzle";
import { posToSquare } from "@/lib/game/fen-puzzle";

/** Stage 3 of docs/specs/2026-07-16-safe-path-promotion-run-plan.md.
 *
 *  The founder's framing is the contract: "un laberinto de peligro, no de
 *  muros. Puedes pasar físicamente por ahí, pero es una zona vigilada, así que
 *  no debes hacerlo."
 *
 *  So LEGAL and SAFE are different questions, and this module keeps them apart:
 *    - legalKingSteps → where the king CAN step (walls and enemies block).
 *    - isCaught       → whether that step KILLS him (D4: legal, and it loses).
 *  BFS routes over legal ∧ ¬caught.
 */

const enemy = (sq: string, piece: TypedEnemy["piece"]): TypedEnemy => ({
  pos: squareToPos(sq),
  piece,
});

const squares = (positions: { file: number; rank: number }[]) =>
  positions.map(posToSquare).sort();

describe("legalKingSteps — the physical maze", () => {
  it("gives all 8 neighbours on an open board", () => {
    const steps = legalKingSteps(squareToPos("d4"), [], []);

    expect(squares(steps)).toEqual(
      ["c3", "c4", "c5", "d3", "d5", "e3", "e4", "e5"].sort(),
    );
  });

  it("clips at the board edge", () => {
    const steps = legalKingSteps(squareToPos("a1"), [], []);

    expect(squares(steps)).toEqual(["a2", "b1", "b2"].sort());
  });

  it("cannot step onto a white obstacle — a wall is a wall", () => {
    const steps = legalKingSteps(squareToPos("a1"), [], [squareToPos("b1")]);

    expect(squares(steps)).toEqual(["a2", "b2"].sort());
  });

  it("cannot step onto an enemy — the king never captures (D1)", () => {
    // This is what keeps the attack map a per-level constant: if the king could
    // take the rook, the rook would stop watching and the map would move.
    const steps = legalKingSteps(squareToPos("a1"), [enemy("b1", "rook")], []);

    expect(squares(steps)).not.toContain("b1");
  });

  it("DOES step onto a watched square — it is legal, and it loses (D4)", () => {
    // The whole point of the founder's model: the danger maze has no walls.
    // b2 is watched by the rook on h2, and the king may walk right into it.
    const steps = legalKingSteps(squareToPos("a1"), [enemy("h2", "rook")], []);

    expect(squares(steps)).toContain("b2");
  });
});

describe("isCaught — the danger maze", () => {
  it("is true on a watched square", () => {
    const caught = isCaught(squareToPos("b2"), [enemy("h2", "rook")]);

    expect(caught).toBe(true);
  });

  it("is false on a square in the ray's shadow", () => {
    const enemies = [enemy("h2", "rook"), enemy("d2", "pawn")];

    expect(isCaught(squareToPos("b2"), enemies)).toBe(false);
  });

  it("is false with no enemies at all", () => {
    expect(isCaught(squareToPos("d4"), [])).toBe(false);
  });
});

describe("safePathOptimalMoves — BFS over safe squares", () => {
  it("counts the straight walk on an empty board", () => {
    // a1 -> a4 is three king steps.
    const moves = safePathOptimalMoves(
      squareToPos("a1"),
      squareToPos("a4"),
      [],
      [],
    );

    expect(moves).toBe(3);
  });

  it("uses the diagonal — a king moves like a king", () => {
    const moves = safePathOptimalMoves(
      squareToPos("a1"),
      squareToPos("c3"),
      [],
      [],
    );

    expect(moves).toBe(2);
  });

  it("routes AROUND a watched file instead of through it", () => {
    // A rook on d8 watches the whole d-file. Walking a1 -> f1 along rank 1
    // would cross d1, so the shortest SAFE route is longer than the shortest
    // route: the king must dip to rank 1... which is also watched. He cannot
    // cross the file at all below rank 8 — so this level has no safe route.
    const enemies = [enemy("d8", "rook")];
    const moves = safePathOptimalMoves(
      squareToPos("a1"),
      squareToPos("f1"),
      enemies,
      [],
    );

    expect(moves).toBeNull();
  });

  it("finds the detour when the watched file has a gap", () => {
    // The rook on d8 watches the d-file, but a white wall on d5 blocks its ray
    // below d5 — so d4..d1 are free and the king crosses on rank 1.
    const enemies = [enemy("d8", "rook")];
    const walls = [squareToPos("d5")];
    const moves = safePathOptimalMoves(
      squareToPos("a1"),
      squareToPos("f1"),
      enemies,
      walls,
    );

    expect(moves).toBe(5);
  });

  it("returns null when the refuge itself is watched", () => {
    // An unwinnable level. The catalog must reject it, so the solver has to
    // SAY so rather than return a route that ends in death.
    const moves = safePathOptimalMoves(
      squareToPos("a1"),
      squareToPos("h1"),
      [enemy("h8", "rook")],
      [],
    );

    expect(moves).toBeNull();
  });

  it("returns null when the king is boxed in", () => {
    const enemies = [enemy("a3", "rook"), enemy("c1", "rook")];
    const moves = safePathOptimalMoves(
      squareToPos("a1"),
      squareToPos("h8"),
      enemies,
      [],
    );

    expect(moves).toBeNull();
  });

  it("returns 0 when the king already stands on the refuge", () => {
    const moves = safePathOptimalMoves(
      squareToPos("d4"),
      squareToPos("d4"),
      [],
      [],
    );

    expect(moves).toBe(0);
  });

  it("never routes through a watched square even when it is the only shortcut", () => {
    // The knight on d3 watches b2 — the diagonal shortcut from a1 to c3 — but
    // not c3 itself. So the refuge stays reachable and the king must walk
    // around: a1 -> b1 -> c2 -> c3.
    const moves = safePathOptimalMoves(
      squareToPos("a1"),
      squareToPos("c3"),
      [enemy("d3", "knight")],
      [],
    );

    expect(moves).toBe(3);
  });
});
