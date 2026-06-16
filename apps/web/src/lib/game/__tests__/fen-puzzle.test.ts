import { describe, expect, it } from "vitest";

import {
  FenError,
  mapFenPuzzle,
  parseFenBoard,
  posToSquare,
  puzzleId,
  squareToPos,
} from "@/lib/game/fen-puzzle";

describe("squareToPos / posToSquare", () => {
  it("maps corners a1 -> {0,0} and h8 -> {7,7}", () => {
    expect(squareToPos("a1")).toEqual({ file: 0, rank: 0 });
    expect(squareToPos("h8")).toEqual({ file: 7, rank: 7 });
  });

  it("round-trips through posToSquare", () => {
    expect(posToSquare({ file: 0, rank: 0 })).toBe("a1");
    expect(posToSquare({ file: 7, rank: 7 })).toBe("h8");
    expect(posToSquare(squareToPos("e4"))).toBe("e4");
  });

  it("throws FenError on junk squares", () => {
    expect(() => squareToPos("z9")).toThrow(FenError);
    expect(() => squareToPos("a")).toThrow(FenError);
    expect(() => squareToPos("")).toThrow(FenError);
  });
});

describe("parseFenBoard", () => {
  it("reads color + type and maps FEN rank-8-first to rank index 7", () => {
    const board = parseFenBoard("7r/8/8/8/8/8/8/R7 w - - 0 1");
    expect(board.get("a1")).toEqual({ color: "w", type: "rook" });
    expect(board.get("h8")).toEqual({ color: "b", type: "rook" });
    expect(board.size).toBe(2);
  });

  it("reads all piece glyphs", () => {
    const board = parseFenBoard("8/8/8/8/8/8/8/QKBNRP1q w - - 0 1");
    expect(board.get("a1")).toEqual({ color: "w", type: "queen" });
    expect(board.get("b1")).toEqual({ color: "w", type: "king" });
    expect(board.get("c1")).toEqual({ color: "w", type: "bishop" });
    expect(board.get("d1")).toEqual({ color: "w", type: "knight" });
    expect(board.get("e1")).toEqual({ color: "w", type: "rook" });
    expect(board.get("f1")).toEqual({ color: "w", type: "pawn" });
    expect(board.get("h1")).toEqual({ color: "b", type: "queen" });
  });

  it("throws when the FEN has the wrong number of ranks", () => {
    expect(() => parseFenBoard("8/8/8 w - - 0 1")).toThrow(FenError);
  });

  it("throws on an empty placement field", () => {
    expect(() => parseFenBoard("   ")).toThrow(FenError);
  });

  it("throws on an invalid piece char", () => {
    expect(() => parseFenBoard("8/8/8/8/8/8/8/X7 w - - 0 1")).toThrow(FenError);
  });

  it("throws when a rank does not fill 8 files", () => {
    expect(() => parseFenBoard("8/8/8/8/8/8/8/R6 w - - 0 1")).toThrow(FenError);
  });

  it("throws when a rank overflows 8 files", () => {
    expect(() => parseFenBoard("8/8/8/8/8/8/8/RRRRRRRRR w - - 0 1")).toThrow(
      FenError,
    );
  });
});

describe("mapFenPuzzle", () => {
  it("maps a rook with explicit mover + a white obstacle", () => {
    const result = mapFenPuzzle({
      kind: "exercise",
      piece: "rook",
      fen: "8/8/8/8/8/8/8/R3R3 w - - 0 1",
      mover: "a1",
      target: "h1",
      tier: "easy",
    });
    expect(result.startPos).toEqual({ file: 0, rank: 0 });
    expect(result.targetPos).toEqual({ file: 7, rank: 0 });
    expect(result.obstacles).toEqual([{ file: 4, rank: 0 }]);
    expect(result.captureTargets).toBeUndefined();
    expect(result.isCapture).toBeUndefined();
    expect(result.kind).toBe("exercise");
    expect(result.piece).toBe("rook");
    expect(result.tier).toBe("easy");
  });

  it("auto-detects a single white mover when none is provided", () => {
    const result = mapFenPuzzle({
      kind: "labyrinth",
      piece: "rook",
      fen: "8/8/8/8/8/8/8/R7 w - - 0 1",
      target: "h1",
      tier: "medium",
    });
    expect(result.startPos).toEqual({ file: 0, rank: 0 });
  });

  it("throws on an ambiguous mover (two white rooks, no mover)", () => {
    expect(() =>
      mapFenPuzzle({
        kind: "exercise",
        piece: "rook",
        fen: "8/8/8/8/8/8/8/R3R3 w - - 0 1",
        target: "h1",
        tier: "easy",
      }),
    ).toThrow(/ambiguous mover/);
  });

  it("throws when there is no white piece of the requested type", () => {
    expect(() =>
      mapFenPuzzle({
        kind: "exercise",
        piece: "rook",
        fen: "8/8/8/8/8/8/8/8 w - - 0 1",
        target: "h1",
        tier: "easy",
      }),
    ).toThrow(/no white rook/);
  });

  it("throws when a black piece faces a non-pawn mover (captures unsupported)", () => {
    expect(() =>
      mapFenPuzzle({
        kind: "exercise",
        piece: "rook",
        fen: "8/8/8/8/8/8/8/R3r3 w - - 0 1",
        target: "h1",
        tier: "easy",
      }),
    ).toThrow(/captures unsupported/);
  });

  it("maps a pawn with a black piece into captureTargets + isCapture", () => {
    const result = mapFenPuzzle({
      kind: "labyrinth",
      piece: "pawn",
      fen: "8/8/8/8/8/3p4/4P3/8 w - - 0 1",
      mover: "e2",
      target: "d3",
      tier: "hard",
    });
    expect(result.startPos).toEqual({ file: 4, rank: 1 });
    expect(result.targetPos).toEqual({ file: 3, rank: 2 });
    expect(result.captureTargets).toEqual([{ file: 3, rank: 2 }]);
    expect(result.isCapture).toBe(true);
    expect(result.obstacles).toBeUndefined();
  });

  it("throws when the target equals the start", () => {
    expect(() =>
      mapFenPuzzle({
        kind: "exercise",
        piece: "rook",
        fen: "8/8/8/8/8/8/8/R7 w - - 0 1",
        mover: "a1",
        target: "a1",
        tier: "easy",
      }),
    ).toThrow(/target equals start/);
  });

  it("throws when an explicit mover square is empty", () => {
    expect(() =>
      mapFenPuzzle({
        kind: "exercise",
        piece: "rook",
        fen: "8/8/8/8/8/8/8/R7 w - - 0 1",
        mover: "h1",
        target: "h8",
        tier: "easy",
      }),
    ).toThrow(/empty/);
  });

  it("passes through tags and explanation -> objective", () => {
    const result = mapFenPuzzle({
      kind: "exercise",
      piece: "rook",
      fen: "8/8/8/8/8/8/8/R7 w - - 0 1",
      mover: "a1",
      target: "h1",
      tier: "easy",
      tags: ["straight-line"],
      explanation: "  slide across the rank  ",
    });
    expect(result.tags).toEqual(["straight-line"]);
    expect(result.objective).toBe("slide across the rank");
  });
});

describe("puzzleId", () => {
  it("is deterministic and content-addressed", () => {
    const a = puzzleId("rook", "8/8/8/8/8/8/8/R7|h1");
    const b = puzzleId("rook", "8/8/8/8/8/8/8/R7|h1");
    expect(a).toBe(b);
    expect(a).toMatch(/^rook-gen-[0-9a-z]{8}$/);
  });

  it("differs across content and piece", () => {
    expect(puzzleId("rook", "x")).not.toBe(puzzleId("rook", "y"));
    expect(puzzleId("rook", "x")).not.toBe(puzzleId("bishop", "x"));
  });
});
