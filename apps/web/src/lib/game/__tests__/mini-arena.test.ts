import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { MINI_ARENA_SETUPS, getSetupById } from "../mini-arena";

describe("mini-arena setups — integrity", () => {
  it("set is non-empty and ids are unique", () => {
    expect(MINI_ARENA_SETUPS.length).toBeGreaterThan(0);
    const ids = MINI_ARENA_SETUPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(MINI_ARENA_SETUPS)("$id ($name) — FEN parses with white to move", (setup) => {
    const game = new Chess(setup.fen);
    expect(game.turn()).toBe("w");
    expect(game.isGameOver()).toBe(false);
  });

  it.each(MINI_ARENA_SETUPS)("$id — both kings present", (setup) => {
    const game = new Chess(setup.fen);
    const board = game.board().flat().filter(Boolean);
    const whiteKings = board.filter((p) => p?.type === "k" && p.color === "w");
    const blackKings = board.filter((p) => p?.type === "k" && p.color === "b");
    expect(whiteKings).toHaveLength(1);
    expect(blackKings).toHaveLength(1);
  });

  it.each(MINI_ARENA_SETUPS)("$id — par budget is positive", (setup) => {
    expect(setup.parMoves).toBeGreaterThan(0);
  });
});

describe("mini-arena getSetupById", () => {
  it("returns the matching setup", () => {
    const setup = getSetupById(MINI_ARENA_SETUPS[0].id);
    expect(setup).toEqual(MINI_ARENA_SETUPS[0]);
  });

  it("returns null for an unknown id", () => {
    expect(getSetupById("does-not-exist")).toBeNull();
  });
});
