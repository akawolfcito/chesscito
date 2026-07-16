import { describe, expect, it } from "vitest";

import { attackedSquares } from "@/lib/game/attack-map";
import type { TypedEnemy } from "@/lib/game/fen-puzzle";
import { squareToPos } from "@/lib/game/fen-puzzle";

/** Stage 2 of docs/specs/2026-07-16-safe-path-promotion-run-plan.md.
 *
 *  This module exists because NONE of lib/game/rules/* can serve a threat
 *  layer — each fails differently, and every failure is a test below. The
 *  rules modules answer "where may this piece MOVE"; this one answers "which
 *  squares are WATCHED". Those are different questions, and the difference is
 *  exactly one square per ray: the one with the blocker standing on it.
 */

const enemy = (sq: string, piece: TypedEnemy["piece"]): TypedEnemy => ({
  pos: squareToPos(sq),
  piece,
});

const attacks = (enemies: TypedEnemy[]) => attackedSquares(enemies);

describe("attackedSquares — rays include the blocker's own square", () => {
  it("a rook watches the square its ray is blocked BY, then stops", () => {
    // getRookMoves breaks BEFORE pushing the blocker (rook.ts:36-38), which is
    // right for movement and wrong here: d5 is exactly where the king dies.
    const set = attacks([enemy("d1", "rook"), enemy("d5", "knight")]);

    expect(set.has("d4")).toBe(true); // clear ray
    expect(set.has("d5")).toBe(true); // the blocker's OWN square is watched
    expect(set.has("d6")).toBe(false); // shadow behind it is safe
    expect(set.has("d7")).toBe(false);
  });

  it("a bishop does the same on the diagonal", () => {
    const set = attacks([enemy("c1", "bishop"), enemy("e3", "rook")]);

    expect(set.has("d2")).toBe(true);
    expect(set.has("e3")).toBe(true); // blocker's square
    expect(set.has("f4")).toBe(false); // shadow
  });

  it("a queen watches both rays, blocker squares included", () => {
    // The blockers are PAWNS on purpose. A rook on d6 would watch d7 itself,
    // and the assertion would fail on the queen's shadow for a reason that has
    // nothing to do with the queen. Black pawns only watch the two squares
    // diagonally below them, so they block the ray without polluting the
    // shadow squares this test is about.
    const set = attacks([enemy("d4", "queen"), enemy("d6", "pawn"), enemy("f6", "pawn")]);

    expect(set.has("d5")).toBe(true);
    expect(set.has("d6")).toBe(true); // straight blocker
    expect(set.has("d7")).toBe(false); // shadow
    expect(set.has("e5")).toBe(true);
    expect(set.has("f6")).toBe(true); // diagonal blocker
    expect(set.has("g7")).toBe(false); // shadow
  });
});

describe("attackedSquares — the pawn is not its movement function", () => {
  it("a black pawn watches its two DOWNWARD diagonals and nothing else", () => {
    // getPawnMoves hardcodes white-moves-up (rank + 1). Enemies are black.
    const set = attacks([enemy("d5", "pawn")]);

    expect(set.has("c4")).toBe(true);
    expect(set.has("e4")).toBe(true);
    expect(set.size).toBe(2);
  });

  it("never watches the square in front of it — a pawn does not capture forward", () => {
    const set = attacks([enemy("d5", "pawn")]);

    expect(set.has("d4")).toBe(false);
    expect(set.has("d3")).toBe(false);
  });

  it("watches its diagonals even when they are empty", () => {
    // getPawnMoves only yields diagonals when isCapture is true. A pawn watches
    // them always — that is what makes a square unsafe to step into.
    const set = attacks([enemy("d5", "pawn")]);

    expect(set.has("c4")).toBe(true);
  });

  it("clips its diagonals at the board edge", () => {
    const set = attacks([enemy("a5", "pawn")]);

    expect(set.has("b4")).toBe(true);
    expect(set.size).toBe(1);
  });

  it("watches nothing from the last rank it could reach", () => {
    const set = attacks([enemy("d1", "pawn")]);

    expect(set.size).toBe(0);
  });
});

describe("attackedSquares — knight and king", () => {
  it("a knight watches all 8 jumps, and blockers do not matter", () => {
    const set = attacks([enemy("d4", "knight"), enemy("d5", "rook"), enemy("e6", "rook")]);

    for (const sq of ["c2", "e2", "b3", "f3", "b5", "f5", "c6", "e6"]) {
      expect(set.has(sq)).toBe(true);
    }
  });

  it("a knight clips its jumps at the edge", () => {
    const set = attacks([enemy("a1", "knight")]);

    expect(set.has("b3")).toBe(true);
    expect(set.has("c2")).toBe(true);
    expect(set.size).toBe(2);
  });

  it("an enemy king watches all 8 neighbours regardless of occupancy", () => {
    // getKingMoves FILTERS blockers out (king.ts:29). For threats they stay.
    const set = attacks([enemy("d4", "king"), enemy("d5", "rook")]);

    expect(set.has("d5")).toBe(true);
    expect(set.has("c3")).toBe(true);
    expect(set.has("e5")).toBe(true);
  });
});

describe("attackedSquares — composition", () => {
  it("unions every enemy's watch into one set", () => {
    const set = attacks([enemy("a1", "rook"), enemy("h8", "bishop")]);

    expect(set.has("a5")).toBe(true); // rook's file
    expect(set.has("e1")).toBe(true); // rook's rank
    expect(set.has("d4")).toBe(true); // bishop's diagonal
  });

  it("enemies watch each other — an enemy's square is not a refuge", () => {
    const set = attacks([enemy("a1", "rook"), enemy("a5", "bishop")]);

    expect(set.has("a5")).toBe(true);
  });

  it("returns an empty set for no enemies", () => {
    expect(attacks([]).size).toBe(0);
  });

  it("does not watch an enemy's own square unless another enemy watches it", () => {
    // A lone rook does not attack the square it stands on.
    const set = attacks([enemy("d4", "rook")]);

    expect(set.has("d4")).toBe(false);
  });
});
