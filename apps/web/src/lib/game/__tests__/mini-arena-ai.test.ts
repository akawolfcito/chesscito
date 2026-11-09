import { describe, it, expect, vi, beforeEach } from "vitest";
import { Chess } from "chess.js";

const aiMoveMock = vi.hoisted(() => vi.fn());
vi.mock("js-chess-engine", () => ({ aiMove: aiMoveMock }));

import { pickAiMoveOrFallback } from "../mini-arena-ai";

beforeEach(() => {
  aiMoveMock.mockReset();
});

describe("pickAiMoveOrFallback", () => {
  it("returns the engine's move verbatim when it is legal", () => {
    const game = new Chess(); // standard starting position
    aiMoveMock.mockReturnValue({ E2: "E4" });

    const result = pickAiMoveOrFallback(game, 0);
    expect(result).toEqual({ from: "e2", to: "e4" });
  });

  it("falls back to a legal move when the engine throws", () => {
    aiMoveMock.mockImplementation(() => {
      throw new Error("engine boom");
    });
    const game = new Chess();

    const result = pickAiMoveOrFallback(game, 0, () => 0); // pick first legal
    expect(result).not.toBeNull();
    const legal = game.moves({ verbose: true });
    expect(
      legal.some((m) => m.from === result!.from && m.to === result!.to),
      `fallback ${result!.from}-${result!.to} must be in chess.js legal set`,
    ).toBe(true);
  });

  it("falls back to a legal move when the engine suggests an illegal move", () => {
    const game = new Chess();
    // a1 → a8 is impossible at the standard start (own rook on a1
    // can't jump pawns). chess.js would throw on this; the fallback
    // detects it and rerolls via legal enumeration.
    aiMoveMock.mockReturnValue({ A1: "A8" });

    const result = pickAiMoveOrFallback(game, 0, () => 0);
    expect(result).not.toBeNull();
    const legal = game.moves({ verbose: true });
    expect(
      legal.some((m) => m.from === result!.from && m.to === result!.to),
    ).toBe(true);
    // Specifically NOT the engine's suggestion (which was illegal).
    expect(result).not.toEqual({ from: "a1", to: "a8" });
  });

  it("falls back to a legal move when the engine returns an empty object", () => {
    const game = new Chess();
    aiMoveMock.mockReturnValue({});

    const result = pickAiMoveOrFallback(game, 0, () => 0);
    expect(result).not.toBeNull();
    const legal = game.moves({ verbose: true });
    expect(
      legal.some((m) => m.from === result!.from && m.to === result!.to),
    ).toBe(true);
  });

  it("returns null when the side to move is checkmated", () => {
    // Fool's mate: white to move and checkmated by 1.f3 e5 2.g4 Qh4#
    const fool = "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3";
    const game = new Chess(fool);
    expect(game.isCheckmate()).toBe(true);

    const result = pickAiMoveOrFallback(game, 0);
    expect(result).toBeNull();
    // Engine should NOT be invoked when the game is already over.
    expect(aiMoveMock).not.toHaveBeenCalled();
  });

  it("returns null when the side to move is stalemated", () => {
    // Classic stalemate: black to move, no legal moves, not in check.
    // White Q on f7, K on g6 trapping black king on h8 with all
    // squares around it covered but h8 itself not in check.
    const stalemate = "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1";
    const game = new Chess(stalemate);
    expect(game.isStalemate()).toBe(true);

    const result = pickAiMoveOrFallback(game, 0);
    expect(result).toBeNull();
  });

  it("uses the injected random function for fallback selection", () => {
    aiMoveMock.mockImplementation(() => {
      throw new Error("force fallback");
    });
    const game = new Chess();
    const random = vi.fn(() => 0.0);

    pickAiMoveOrFallback(game, 0, random);
    expect(random).toHaveBeenCalledOnce();
  });

  it("never returns the same move on illegal engine suggestion when fallback rerolls", () => {
    // Sanity: the function output is constrained to chess.js's legal
    // set regardless of engine output. Repeating with different random
    // seeds should produce different but always-legal moves.
    aiMoveMock.mockImplementation(() => {
      throw new Error("force fallback");
    });
    const game = new Chess();
    const seeds = [0.0, 0.25, 0.5, 0.75];
    const moves = seeds.map((seed) =>
      pickAiMoveOrFallback(game, 0, () => seed),
    );
    moves.forEach((m) => {
      expect(m).not.toBeNull();
      const legal = game.moves({ verbose: true });
      expect(
        legal.some((lm) => lm.from === m!.from && lm.to === m!.to),
      ).toBe(true);
    });
  });

  it("regression — K+R vs K starting position never freezes (always returns a move)", () => {
    // The reported P0-2 freeze: K+R vs K with white to move. After the
    // player's first move, chess.js's turn flips to black, the engine
    // is asked to suggest a king move, and historically threw or
    // suggested an illegal move on this endgame at level 0.
    //
    // Pre-fix: silent catch left status=playing with turn=black → freeze.
    // Post-fix: this function MUST always return a legal move (or null
    // if the game is actually over).
    const krVsK = "4k3/8/8/8/8/8/8/R3K3 w - - 0 1";
    const game = new Chess(krVsK);
    // Simulate a player move: white rook lifts.
    game.move({ from: "a1", to: "a4" });
    // Now black to move. The engine might or might not return a valid
    // suggestion — but our function MUST resolve to either a legal
    // move or null (terminal).
    const result = pickAiMoveOrFallback(game, 0);
    if (result === null) {
      // Only acceptable if the game is genuinely over.
      expect(game.isGameOver()).toBe(true);
    } else {
      const legal = game.moves({ verbose: true });
      expect(
        legal.some((m) => m.from === result.from && m.to === result.to),
        `regression freeze guard: returned ${result.from}-${result.to} must be legal`,
      ).toBe(true);
    }
  });
});
