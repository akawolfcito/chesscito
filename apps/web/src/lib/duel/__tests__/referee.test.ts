import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";

import { applyMove, STARTING_FEN } from "../referee";

/** Tests may replay; the referee may not. */
function fenAfter(moves: readonly string[]): string {
  const game = new Chess();
  for (const move of moves) game.move(move);
  return game.fen();
}

describe("applyMove — whose turn it is", () => {
  it("refuses a move from the seat that is not on move", () => {
    const result = applyMove(STARTING_FEN, [], "b", "e5");
    expect(result).toEqual({ ok: false, code: "not-your-turn" });
  });

  it("accepts the seat on move and returns the new position", () => {
    const result = applyMove(STARTING_FEN, [], "w", "e4");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.san).toBe("e4");
    expect(result.fen).toBe(fenAfter(["e4"]));
    expect(result.outcome).toBeNull();
  });
});

describe("applyMove — legality is the server's call", () => {
  it("rejects a move that does not exist in the position", () => {
    expect(applyMove(STARTING_FEN, [], "w", "e5")).toEqual({
      ok: false,
      code: "illegal-move",
    });
  });

  it("rejects garbage without throwing", () => {
    expect(applyMove(STARTING_FEN, [], "w", "not-a-move")).toEqual({
      ok: false,
      code: "illegal-move",
    });
    expect(applyMove(STARTING_FEN, [], "w", "")).toEqual({
      ok: false,
      code: "illegal-move",
    });
  });

  it("rejects a move that would leave its own king in check", () => {
    // The knight on e7 is the only thing between the rook on e1 and the king
    // on e8. `Nc6` is a legal knight move and an illegal chess move.
    const fen = "4k3/4n3/8/8/8/8/8/4RK2 b - - 0 1";
    expect(applyMove(fen, [], "b", "Nc6")).toEqual({
      ok: false,
      code: "illegal-move",
    });
    // The position itself is not stuck: stepping the king off the file is legal.
    expect(applyMove(fen, [], "b", "Kd8").ok).toBe(true);
  });

  it("promotes only with the piece the SAN names", () => {
    const fen = "8/4P3/8/8/8/8/6k1/4K3 w - - 0 1";
    const promoted = applyMove(fen, [], "w", "e8=N");
    expect(promoted.ok).toBe(true);
    if (!promoted.ok) return;
    expect(promoted.fen.startsWith("4N3/")).toBe(true);
  });
});

describe("applyMove — how the game ends", () => {
  it("calls checkmate for the seat that delivered it", () => {
    const fen = fenAfter(["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6"]);
    const result = applyMove(fen, [], "w", "Qxf7#");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.outcome).toEqual({ kind: "checkmate", winner: "w" });
  });

  it("calls stalemate a draw", () => {
    const result = applyMove("7k/5K2/8/8/8/8/8/6Q1 w - - 0 1", [], "w", "Qg6");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.outcome).toEqual({ kind: "draw", reason: "stalemate" });
  });

  it("calls insufficient material a draw", () => {
    const result = applyMove("7k/8/8/8/8/8/8/nK6 w - - 0 1", [], "w", "Kxa1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.outcome).toEqual({
      kind: "draw",
      reason: "insufficient-material",
    });
  });

  it("calls the fifty-move rule a draw on the hundredth half-move", () => {
    const result = applyMove("7k/8/8/8/8/8/8/R3K3 w - - 99 60", [], "w", "Ra2");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.outcome).toEqual({ kind: "draw", reason: "fifty-move" });
  });

  it("calls threefold repetition a draw — this is what `moves` is for", () => {
    const played = ["Nf3", "Nf6", "Ng1", "Ng8", "Nf3", "Nf6", "Ng1"];
    const result = applyMove(fenAfter(played), played, "b", "Ng8");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.outcome).toEqual({
      kind: "draw",
      reason: "threefold-repetition",
    });
  });

  it("does not call a draw on the SECOND occurrence of a position", () => {
    const played = ["Nf3", "Nf6", "Ng1"];
    const result = applyMove(fenAfter(played), played, "b", "Ng8");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.outcome).toBeNull();
  });

  it("leaves an ordinary move without an outcome", () => {
    const result = applyMove(fenAfter(["e4"]), ["e4"], "b", "e5");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.outcome).toBeNull();
  });
});

describe("applyMove — the position is the FEN, never a replay", () => {
  it("judges the move against the FEN even when `moves` belongs to another game", () => {
    // A referee that rebuilt the game from move 1 would be playing a different
    // position here and would reject `e5` (or crash on the foreign history).
    const foreign = ["d4", "d5", "c4", "e6", "Nc3", "Nf6"];
    const result = applyMove(fenAfter(["e4"]), foreign, "b", "e5");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fen).toBe(fenAfter(["e4", "e5"]));
  });

  it("works with an empty history mid-game — the FEN carries the position", () => {
    const fen = fenAfter(["e4", "e5", "Nf3", "Nc6", "Bb5"]);
    const result = applyMove(fen, [], "b", "a6");
    expect(result.ok).toBe(true);
  });

  it("survives a history it cannot replay instead of throwing", () => {
    // The half-move clock is past the gate here, so the repetition walk really
    // runs and really chokes on this history. A missed draw beats a rejected
    // legal move.
    const played = ["Nf3", "Nf6", "Ng1", "Ng8", "Nf3", "Nf6", "Ng1", "Ng8", "Nf3"];
    const fen = fenAfter(played);
    expect(fen.split(" ")[4]).toBe("9");
    const result = applyMove(fen, ["garbage", "!!"], "b", "Nf6");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.outcome).toBeNull();
  });
});
