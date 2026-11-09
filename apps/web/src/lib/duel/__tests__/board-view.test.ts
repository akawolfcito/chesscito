import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";

import { duelBoardView } from "../board-view";
import { STARTING_FEN } from "../referee";

/** Play `sans` from the start and report the position they reach. */
function after(...sans: string[]) {
  const game = new Chess();
  for (const san of sans) game.move(san);
  return { fen: game.fen(), moves: sans };
}

describe("the trail of the last move", () => {
  /** ⛔ The regression this file closes: the duel shipped with `lastMove={null}`
   *  hardcoded, so the board the AI arena draws with a trail had none here. */
  it("names the two squares of the move just played", () => {
    const { fen, moves } = after("e4");

    expect(duelBoardView(fen, moves).lastMove).toEqual({ from: "e2", to: "e4" });
  });

  it("follows the game rather than staying on the first move", () => {
    const { fen, moves } = after("e4", "e5", "Nf3");

    expect(duelBoardView(fen, moves).lastMove).toEqual({ from: "g1", to: "f3" });
  });

  it("has no trail before anybody has moved", () => {
    expect(duelBoardView(STARTING_FEN, []).lastMove).toBeNull();
  });

  /** ⛔ A history it cannot replay costs a highlight, never the game. */
  it("gives up quietly on a history that does not replay", () => {
    expect(duelBoardView(STARTING_FEN, ["e4", "Qxz9"]).lastMove).toBeNull();
    expect(() => duelBoardView("not a fen", ["e4"])).not.toThrow();
  });
});

describe("the king in check", () => {
  /**
   * ⚠️ It is the king of the side TO MOVE, not of whoever moved. Reading it the
   * other way round tints a perfectly safe king every time a check is given.
   */
  it("finds the king that is actually under attack", () => {
    // 1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7+ — black is in check on e8.
    const { fen, moves } = after("e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6", "Qxf7+");

    expect(duelBoardView(fen, moves).checkSquare).toBe("e8");
  });

  it("has nothing to tint in a quiet position", () => {
    const { fen, moves } = after("e4", "e5");

    expect(duelBoardView(fen, moves).checkSquare).toBeNull();
  });

  it("survives a position it cannot parse", () => {
    expect(duelBoardView("garbage", []).checkSquare).toBeNull();
  });
});
