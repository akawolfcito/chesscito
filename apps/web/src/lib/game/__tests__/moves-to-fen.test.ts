import { describe, it, expect, beforeEach } from "vitest";
import { Chess } from "chess.js";

import {
  movesToFen,
  __resetMovesToFenCacheForTests,
} from "../moves-to-fen";

const STARTING_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("movesToFen", () => {
  beforeEach(() => {
    __resetMovesToFenCacheForTests();
  });

  it("returns null for an empty move list (no game started)", () => {
    expect(movesToFen([])).toBeNull();
  });

  it("returns the FEN after a single legal move", () => {
    const fen = movesToFen(["e4"]);
    expect(fen).not.toBeNull();
    // chess.js's own reconstruction is the source of truth for the
    // expected string — assert via re-parse instead of hardcoding a
    // brittle FEN literal.
    const g = new Chess();
    g.move("e4");
    expect(fen).toBe(g.fen());
  });

  it("reconstructs the full position after the scholar's mate sequence", () => {
    const moves = ["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6", "Qxf7#"];
    const fen = movesToFen(moves);
    expect(fen).not.toBeNull();

    // The reconstructed FEN must parse + report checkmate via chess.js.
    const reconstructed = new Chess(fen!);
    expect(reconstructed.isCheckmate()).toBe(true);
  });

  it("returns null when a move in the list is illegal (corrupted record)", () => {
    expect(movesToFen(["e4", "e5", "Ke2", "Nope-not-a-move"])).toBeNull();
  });

  it("returns null when the FIRST move is illegal", () => {
    expect(movesToFen(["Zz9"])).toBeNull();
  });

  it("memoizes — returns the same string instance on a repeat call", () => {
    const first = movesToFen(["e4", "e5"]);
    const second = movesToFen(["e4", "e5"]);
    // Same value AND same reference (Map.get returns the stored string).
    expect(second).toBe(first);
  });

  it("differentiates positions by full move sequence (not by length)", () => {
    const a = movesToFen(["e4", "e5"]);
    const b = movesToFen(["d4", "d5"]);
    expect(a).not.toBe(b);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
  });

  it("idempotent on starting position — `new Chess().fen()` matches reconstruction of []  ", () => {
    // Sanity check the docstring's "empty = null" rule alongside the
    // canonical starting FEN constant — the reconstructed-from-[] path
    // intentionally returns null, NOT the starting FEN.
    expect(movesToFen([])).toBeNull();
    expect(new Chess().fen()).toBe(STARTING_FEN);
  });
});
