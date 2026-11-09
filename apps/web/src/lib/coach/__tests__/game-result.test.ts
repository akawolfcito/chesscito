import { describe, it, expect } from "vitest";
import { mapArenaResult } from "../game-result.js";

describe("mapArenaResult", () => {
  it("maps checkmate + player win to 'win'", () => {
    expect(mapArenaResult("checkmate", true)).toEqual("win");
  });
  it("maps checkmate + player loss to 'lose'", () => {
    expect(mapArenaResult("checkmate", false)).toEqual("lose");
  });
  it("maps stalemate to 'draw'", () => {
    expect(mapArenaResult("stalemate", false)).toEqual("draw");
  });
  it("maps draw to 'draw'", () => {
    expect(mapArenaResult("draw", false)).toEqual("draw");
  });
  it("maps resigned to 'resigned'", () => {
    expect(mapArenaResult("resigned", false)).toEqual("resigned");
  });
});
