import { describe, expect, it } from "vitest";

import {
  legalPawnMoves,
  promotionRunSolve,
  type PawnRunState,
} from "@/lib/game/promotion-run";
import { squareToPos, type TypedEnemy } from "@/lib/game/fen-puzzle";
import { posToSquare } from "@/lib/game/fen-puzzle";

/** Stage 7 of docs/specs/2026-07-16-safe-path-promotion-run-plan.md.
 *
 *  The pawn's whole lesson: it moves and it eats DIFFERENTLY, so it cannot
 *  change file without capturing. Everything below is that rule, or a
 *  consequence of it.
 *
 *  ⚠️ Unlike Safe Path, the attack map here is LIVE (P2): the pawn captures, and
 *  a captured enemy stops watching. Cheap only because a pawn never retreats —
 *  the run is a DAG of at most 3^6 paths (§3.4). Do not carry that back to the
 *  king.
 */

const enemy = (sq: string, piece: TypedEnemy["piece"]): TypedEnemy => ({
  pos: squareToPos(sq),
  piece,
});

const state = (sq: string, enemies: TypedEnemy[]): PawnRunState => ({
  pawn: squareToPos(sq),
  enemies,
});

const moves = (s: PawnRunState, walls: string[] = []) =>
  legalPawnMoves(s, walls.map(squareToPos))
    .map((m) => posToSquare(m.to))
    .sort();

describe("legalPawnMoves — it moves and it eats differently", () => {
  it("pushes straight onto an empty square", () => {
    expect(moves(state("c2", []))).toEqual(["c3"]);
  });

  it("never moves diagonally onto an EMPTY square", () => {
    // The rule the whole game is built on. b3/d3 are empty, so they are not
    // moves — the pawn has no way to reach them.
    expect(moves(state("c2", []))).toEqual(["c3"]);
  });

  it("captures diagonally when there IS a victim", () => {
    expect(moves(state("c3", [enemy("b4", "pawn")]))).toEqual(["b4", "c4"]);
  });

  it("captures on both diagonals at once", () => {
    const s = state("c3", [enemy("b4", "pawn"), enemy("d4", "pawn")]);

    expect(moves(s)).toEqual(["b4", "c4", "d4"]);
  });

  it("cannot push THROUGH an enemy standing in front of it", () => {
    // A blocked file is the trap: the pawn cannot go around, only through a
    // diagonal capture.
    expect(moves(state("c3", [enemy("c4", "rook")]))).toEqual([]);
  });

  it("escapes a blocked file by capturing — the only way to change file", () => {
    const s = state("c3", [enemy("c4", "rook"), enemy("b4", "pawn")]);

    expect(moves(s)).toEqual(["b4"]);
  });

  it("cannot push onto a wall either", () => {
    expect(moves(state("c3", []), ["c4"])).toEqual([]);
  });

  it("never captures a wall — a wall is not a piece", () => {
    expect(moves(state("c3", []), ["b4"])).toEqual(["c4"]);
  });

  it("never retreats, and never moves sideways", () => {
    const to = moves(state("c4", [enemy("b3", "pawn"), enemy("d3", "pawn")]));

    expect(to).toEqual(["c5"]);
  });

  it("clips at the edge of the board", () => {
    expect(moves(state("a3", [enemy("b4", "pawn")]))).toEqual(["a4", "b4"]);
  });

  it("reports WHICH enemy a capture removes", () => {
    // The solver needs this: a captured enemy stops watching, mid-run.
    const s = state("c3", [enemy("b4", "rook")]);
    const capture = legalPawnMoves(s, []).find(
      (m) => posToSquare(m.to) === "b4",
    );

    expect(capture?.captures).toEqual(squareToPos("b4"));
  });

  it("marks a push as capturing nothing", () => {
    const push = legalPawnMoves(state("c2", []), []).find(
      (m) => posToSquare(m.to) === "c3",
    );

    expect(push?.captures).toBeNull();
  });
});

describe("promotionRunSolve — the founder's sketch", () => {
  /**
   * c2 -> c3 -> xb4 -> b5 -> xc6 -> c7 -> c8. Each file change is paid for with
   * a capture, so the two rooks are the STEPS, not the obstacles.
   *
   * ⚠️ Both victims are ROOKS, and that is forced. A victim is alive for every
   * step before the pawn eats it, so it may not attack the start or the path so
   * far — which rules out almost everything that can sit next to the pawn:
   *   knight b4 attacks c2, the START;  pawn/bishop/king on b4 attack c3.
   * A rook on b4 attacks only its file and rank 4 (b5/b6 — long gone by then —
   * plus a4/c4). Measured with the solver, not reasoned about: the first cut of
   * this fixture used a knight and the level was dead on move zero.
   */
  const SKETCH: TypedEnemy[] = [
    enemy("b4", "rook"), // the step OUT of the c-file
    enemy("c6", "rook"), // the step BACK into it
  ];
  /** Walls, not pieces: scenery cannot watch anything back. c4 forces the first
   *  capture, b6 forces the second — without it the pawn just walks the b-file. */
  const SKETCH_WALLS = [squareToPos("c4"), squareToPos("b6")];

  it("finds the zigzag when captures are the only way through", () => {
    const run = promotionRunSolve(
      squareToPos("c2"),
      SKETCH,
      SKETCH_WALLS,
      { promoteTo: "queen" },
    );

    expect(run).not.toBeNull();
    expect(run!.map(posToSquare)).toEqual(["c3", "b4", "b5", "c6", "c7", "c8"]);
  });

  it("refuses a level whose pawn is already in range on move zero", () => {
    // The trap that killed the first cut of the fixture above: a knight on b4
    // attacks c2. The pawn would be taken before it ever moved.
    const run = promotionRunSolve(
      squareToPos("c2"),
      [enemy("b4", "knight"), enemy("c6", "rook")],
      SKETCH_WALLS,
      { promoteTo: "queen" },
    );

    expect(run).toBeNull();
  });

  it("returns null when the pawn is sealed in with nothing to eat", () => {
    // A rook in front and no victim on either diagonal: the run is over before
    // it starts, and the level must never ship.
    const run = promotionRunSolve(
      squareToPos("c2"),
      [enemy("c3", "rook")],
      [],
      { promoteTo: "queen" },
    );

    expect(run).toBeNull();
  });

  it("refuses a route that lands on a watched square (P1)", () => {
    // The founder's example: a rook on the 6th rank sees c6, so xc6 walks into
    // it — the pawn captures, and is captured back. That is a trade, and it is
    // real chess.
    //
    // ⚠️ He put the rook on a6; here it must be h6. His sketch had no walls,
    // and the b6 wall this level needs to force the zigzag also blocks a6's ray
    // — the threat never reaches c6. Same idea, one file over.
    const run = promotionRunSolve(
      squareToPos("c2"),
      [...SKETCH, enemy("h6", "rook")],
      SKETCH_WALLS,
      { promoteTo: "queen" },
    );

    expect(run).toBeNull();
  });

  it("treats a new enemy as a new STEP, not a new obstacle", () => {
    // The pawn's logic, at its most surprising: put the founder's rook on a6,
    // where the b6 wall blanks its ray, and it does not threaten — it FEEDS.
    // b5 x a6 is a capture the level did not have before, and the pawn crowns
    // on the a-file instead. Adding an enemy made the level EASIER.
    const run = promotionRunSolve(
      squareToPos("c2"),
      [...SKETCH, enemy("a6", "rook")],
      SKETCH_WALLS,
      { promoteTo: "queen" },
    );

    expect(run!.map(posToSquare)).toEqual(["c3", "b4", "b5", "a6", "a7", "a8"]);
  });

  it("sees that a capture UNWATCHES the square it was watching (P2)", () => {
    // The live map, in one test. The rook on c4 watches b4 — so b4 looks fatal.
    // But the only way onto b4 is by capturing the pawn ON b4... which does not
    // help. Capturing the ROOK first is what clears its watch, and the pawn can
    // only do that from b3.
    const run = promotionRunSolve(
      squareToPos("b3"),
      [enemy("c4", "rook"), enemy("b4", "pawn")],
      [],
      { promoteTo: "queen" },
    );

    // xc4 removes the rook; from there the file is open and unwatched.
    expect(run).not.toBeNull();
    expect(posToSquare(run![0])).toBe("c4");
  });

  it("returns the SHORTEST run when several promote", () => {
    const run = promotionRunSolve(squareToPos("c6"), [], [], {
      promoteTo: "queen",
    });

    expect(run!.map(posToSquare)).toEqual(["c7", "c8"]);
  });

  it("does not care WHICH piece the mission asks for — that is the board's call", () => {
    // The route to the last rank is the same whatever you crown. The mission is
    // checked at promotion, not during the walk; a solver that filtered routes
    // by `promoteTo` would be answering a question nobody asked.
    const asQueen = promotionRunSolve(squareToPos("c6"), [], [], {
      promoteTo: "queen",
    });
    const asKnight = promotionRunSolve(squareToPos("c6"), [], [], {
      promoteTo: "knight",
    });

    expect(asKnight).toEqual(asQueen);
  });

  it("promotes onto a diagonal square only when it holds a victim", () => {
    // The authoring trap from the parent spec: b8 is reachable from c7 ONLY by
    // capturing, so it needs something to capture. Walls seal the c-file.
    const run = promotionRunSolve(
      squareToPos("c7"),
      [enemy("b8", "rook")],
      [squareToPos("c8")],
      { promoteTo: "queen" },
    );

    expect(run!.map(posToSquare)).toEqual(["b8"]);
  });

  it("returns null when the promotion square is diagonal and EMPTY", () => {
    // Same level minus the victim: the pawn reaches c7 and stares at the last
    // rank forever. Cheap to author by accident — it must fail at import.
    const run = promotionRunSolve(
      squareToPos("c7"),
      [],
      [squareToPos("c8")],
      { promoteTo: "queen" },
    );

    expect(run).toBeNull();
  });
});
