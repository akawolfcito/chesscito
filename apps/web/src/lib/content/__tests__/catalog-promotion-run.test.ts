import { describe, expect, it } from "vitest";
import {
  buildCatalog,
  renderGeneratedModule,
  type LabyrinthRecord,
} from "@/lib/content/catalog";

/**
 * Stage 8 of docs/specs/2026-07-16-safe-path-promotion-run-plan.md.
 *
 * Promotion Run rows share content/labyrinths.json with every other kind, routed
 * by `kind` into their own bucket. Two things make this kind unlike all four
 * before it:
 *
 * 1. It has NO target square. The pawn crowns on the last RANK, on whatever file
 *    the captures happened to lead to — the solver proves it by crowning on a8
 *    in a level sketched down the c-file. So it is targetless like the coverage
 *    kinds, yet graded by ARRIVAL like the labyrinths. It is the first kind that
 *    is one without the other.
 * 2. It carries a MISSION (`promoteTo`, P3): the level names the piece to crown,
 *    and choosing IS the mechanic. A mission a pawn cannot legally promote to is
 *    an unwinnable level and must fail at import, not ship.
 *
 * The route itself is measured by `promotionRunSolve` — exhaustive, so exact.
 * The generic BFS cannot measure this game at all: a pawn cannot change file
 * without capturing, and a BFS that does not know that reports routes through
 * empty diagonals the pawn may never take.
 */

/** Pawn c2, a wall on c4, a black rook on b4.
 *
 *  The c-file is sealed at c4, so the pawn cannot go around — there is no
 *  around. The rook on b4 is not the obstacle, it is the STEP: c3, xb4, and the
 *  b-file is open all the way to b8. Six moves, exactly one of them a capture.
 *
 *  ⚠️ The victim is a ROOK, and that is forced (see promotion-run.test.ts): it is
 *  alive for every step before it is eaten, so it must not attack the start or
 *  the path. A rook on b4 watches its file and rank 4 — never c2, never c3. A
 *  knight there would attack c2 and the level would be dead on move zero. */
const runRecord = (over: Partial<LabyrinthRecord> = {}): LabyrinthRecord => ({
  id: "promotion-run-test",
  piece: "pawn",
  kind: "promotion-run",
  fen: "8/8/8/8/1rN5/8/2P5/8 w - - 0 1",
  mover: "c2",
  promoteTo: "queen",
  order: 0,
  ...over,
});

describe("buildCatalog — promotion-run routing", () => {
  it("routes the row to the promotionRun bucket, never to labyrinths", () => {
    const cat = buildCatalog([], [runRecord()], []);

    expect(cat.errors).toEqual([]);
    expect(cat.promotionRun.pawn).toHaveLength(1);
    expect(cat.labyrinths.pawn).toHaveLength(0);
    expect(cat.safePath.pawn).toHaveLength(0);
  });

  it("models the black pieces as typed ENEMIES, not as capture targets", () => {
    // The pawn is the one piece whose black pieces were already legal — as
    // untyped `captureTargets`. This kind needs the type: the attack map has to
    // know a rook from a knight to know what it watches.
    const cat = buildCatalog([], [runRecord()], []);

    expect(cat.promotionRun.pawn[0].enemies).toEqual([
      { pos: { file: 1, rank: 3 }, piece: "rook" },
    ]);
  });

  it("carries the mission into the catalog", () => {
    // Without it the board cannot know which piece to demand, and P3 (choosing
    // IS the mechanic) has nothing to check against.
    const cat = buildCatalog([], [runRecord({ promoteTo: "knight" })], []);

    expect(cat.promotionRun.pawn[0].mission).toEqual({ promoteTo: "knight" });
  });

  it("stores the run length the solver measured", () => {
    // c3, xb4, b5, b6, b7, b8.
    const cat = buildCatalog([], [runRecord()], []);

    expect(cat.promotionRun.pawn[0].optimalMoves).toBe(6);
  });

  it("needs no target — the pawn crowns on a RANK, not on a square", () => {
    // Unlike safe-path, which fails without one. The file it crowns on is
    // decided by the captures, so naming a square would be a lie the moment a
    // shorter route crowned one file over.
    const cat = buildCatalog([], [runRecord({ target: undefined })], []);

    expect(cat.errors).toEqual([]);
    expect(cat.promotionRun.pawn).toHaveLength(1);
  });

  it("rejects a level with no winning run at all", () => {
    // A wall in front and nothing on either diagonal: the pawn cannot move, and
    // a pawn that cannot move is not a puzzle. Cheap to author by accident.
    const cat = buildCatalog(
      [],
      [runRecord({ fen: "8/8/8/8/8/2N5/2P5/8 w - - 0 1" })],
      [],
    );

    expect(cat.promotionRun.pawn).toHaveLength(0);
    expect(cat.errors[0]).toContain("no winning run");
  });

  it("rejects a level whose pawn is watched on move zero", () => {
    // A knight on b4 attacks c2. The player would lose before touching
    // anything — reachable is not achievable, and only the attack map can say.
    const cat = buildCatalog(
      [],
      [runRecord({ fen: "8/8/8/8/1nN5/8/2P5/8 w - - 0 1" })],
      [],
    );

    expect(cat.promotionRun.pawn).toHaveLength(0);
    expect(cat.errors[0]).toContain("no winning run");
  });

  it("rejects a mission a pawn can never promote to", () => {
    // The level is walkable, so every route-based check passes it — and it is
    // still unwinnable, because no pawn in chess has ever become a king. The
    // mission is the win condition, so an impossible mission is an unwinnable
    // level, and it must fail here rather than strand a player on rank 8.
    const cat = buildCatalog([], [runRecord({ promoteTo: "king" })], []);

    expect(cat.promotionRun.pawn).toHaveLength(0);
    expect(cat.errors[0]).toContain("cannot promote to king");
  });

  it("rejects a mission to promote to a pawn", () => {
    // The other half of the same rule, and the easier one to typo.
    const cat = buildCatalog([], [runRecord({ promoteTo: "pawn" })], []);

    expect(cat.promotionRun.pawn).toHaveLength(0);
    expect(cat.errors[0]).toContain("cannot promote to pawn");
  });

  it("rejects a promotion-run level with no mission", () => {
    const cat = buildCatalog([], [runRecord({ promoteTo: undefined })], []);

    expect(cat.promotionRun.pawn).toHaveLength(0);
    expect(cat.errors[0]).toContain("promoteTo");
  });

  it("never calls a promotion-run wall decorative — the BFS may not judge it", () => {
    // The founder's sketch: walls on c4 AND b6, rooks on b4 and c6. The generic
    // peel called b6 droppable with an "optimal" of 0 — and b6 is the only
    // reason the level has a second capture. Drop it and the pawn walks the
    // b-file and the game is gone.
    //
    // The peel is not wrong about this level, it is wrong about this GAME: it
    // routes pawns diagonally across empty squares. A wrong answer that names a
    // square is worse than no answer, because an author will act on it.
    const cat = buildCatalog(
      [],
      [runRecord({ fen: "8/8/1Nr5/8/1rN5/8/2P5/8 w - - 0 1" })],
      [],
    );

    expect(cat.errors).toEqual([]);
    expect(cat.warnings.join(" ")).not.toContain("decorative");
  });

  it("warns when the run needs no captures — the pawn just marches", () => {
    // The pawn's whole lesson is that it cannot change file without capturing.
    // A level whose shortest run is a straight push up an open file never asks
    // that question: the enemies are scenery and the game is a walk.
    //
    // A WARNING, not an error — the level is playable, and the founder tunes
    // feel in the builder. Telling him it teaches nothing beats refusing his
    // draft. Same call as safe-path's decorative-threats warning.
    const cat = buildCatalog(
      [],
      [runRecord({ fen: "8/8/8/8/8/8/2P5/7r w - - 0 1" })],
      [],
    );

    expect(cat.errors).toEqual([]);
    expect(cat.promotionRun.pawn).toHaveLength(1);
    expect(cat.warnings.join(" ")).toContain("never has to capture");
  });
});

describe("renderGeneratedModule — promotion-run", () => {
  it("emits the bucket, so the levels can reach the runtime", () => {
    const cat = buildCatalog([], [runRecord()], []);
    const module = renderGeneratedModule(cat);

    expect(module).toContain("export const GENERATED_PROMOTION_RUN");
    expect(module).toContain("promotion-run-test");
  });
});
