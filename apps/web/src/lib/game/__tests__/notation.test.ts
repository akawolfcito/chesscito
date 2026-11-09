import { describe, expect, it } from "vitest";
import { defineExercise, defineLabyrinth, sq } from "@/lib/game/notation";

describe("sq — coordinate parser", () => {
  it("parses a1 to file=0 rank=0", () => {
    expect(sq("a1")).toEqual({ file: 0, rank: 0 });
  });

  it("parses h8 to file=7 rank=7", () => {
    expect(sq("h8")).toEqual({ file: 7, rank: 7 });
  });

  it("parses d5 to file=3 rank=4", () => {
    expect(sq("d5")).toEqual({ file: 3, rank: 4 });
  });

  it("throws on file outside a-h (i5)", () => {
    expect(() => sq("i5")).toThrow(RangeError);
  });

  it("throws on rank outside 1-8 (a9)", () => {
    expect(() => sq("a9")).toThrow(RangeError);
  });

  it("throws on non-coordinate string (foo)", () => {
    expect(() => sq("foo")).toThrow(RangeError);
  });

  it("throws on empty string", () => {
    expect(() => sq("")).toThrow(RangeError);
  });

  it("throws on single character input", () => {
    expect(() => sq("a")).toThrow(RangeError);
  });

  it("throws on file a0 (rank below 1)", () => {
    expect(() => sq("a0")).toThrow(RangeError);
  });
});

describe("defineExercise", () => {
  it("returns an Exercise with parsed positions", () => {
    const ex = defineExercise({
      id: "rook-6",
      piece: "rook",
      start: "a1",
      target: "h8",
      optimalMoves: 2,
    });
    expect(ex).toEqual({
      id: "rook-6",
      startPos: { file: 0, rank: 0 },
      targetPos: { file: 7, rank: 7 },
      optimalMoves: 2,
    });
  });

  it("includes isCapture when provided", () => {
    const ex = defineExercise({
      id: "pawn-6",
      piece: "pawn",
      start: "a2",
      target: "a4",
      optimalMoves: 1,
      isCapture: true,
    });
    expect(ex.isCapture).toBe(true);
  });

  it("omits isCapture when not provided", () => {
    const ex = defineExercise({
      id: "rook-7",
      piece: "rook",
      start: "a1",
      target: "h1",
      optimalMoves: 1,
    });
    expect(ex.isCapture).toBeUndefined();
  });

  it("throws when start equals target", () => {
    expect(() =>
      defineExercise({
        id: "bad",
        piece: "rook",
        start: "a1",
        target: "a1",
        optimalMoves: 1,
      }),
    ).toThrow("must be different");
  });
});

describe("defineLabyrinth", () => {
  it("returns a labyrinth Exercise with parsed obstacles", () => {
    const lab = defineLabyrinth({
      id: "pawn-lab-6",
      start: "a2",
      target: "d7",
      obstacles: ["a3", "a4"],
      isCapture: true,
      optimalMoves: 5,
    });
    expect(lab).toEqual({
      id: "pawn-lab-6",
      startPos: { file: 0, rank: 1 },
      targetPos: { file: 3, rank: 6 },
      optimalMoves: 5,
      isCapture: true,
      obstacles: [
        { file: 0, rank: 2 },
        { file: 0, rank: 3 },
      ],
    });
  });

  it("works without obstacles and isCapture", () => {
    const lab = defineLabyrinth({
      id: "knight-lab-6",
      start: "a1",
      target: "h8",
      optimalMoves: 6,
    });
    expect(lab.obstacles).toBeUndefined();
  });

  it("throws when obstacle overlaps start", () => {
    expect(() =>
      defineLabyrinth({
        id: "bad",
        start: "a2",
        target: "d7",
        obstacles: ["a2"],
        optimalMoves: 3,
      }),
    ).toThrow("overlaps start");
  });

  it("throws when obstacle overlaps target", () => {
    expect(() =>
      defineLabyrinth({
        id: "bad",
        start: "a2",
        target: "d7",
        obstacles: ["d7"],
        optimalMoves: 3,
      }),
    ).toThrow("overlaps target");
  });

  it("throws on duplicate obstacles", () => {
    expect(() =>
      defineLabyrinth({
        id: "bad",
        start: "a2",
        target: "d7",
        obstacles: ["a3", "a3"],
        optimalMoves: 3,
      }),
    ).toThrow("Duplicate obstacle");
  });

  it("throws when start equals target", () => {
    expect(() =>
      defineLabyrinth({
        id: "bad",
        start: "a1",
        target: "a1",
        obstacles: [],
        optimalMoves: 1,
      }),
    ).toThrow("must be different");
  });

  it("validates obstacle coordinates (throws on bad squares)", () => {
    expect(() =>
      defineLabyrinth({
        id: "bad",
        start: "a2",
        target: "d7",
        obstacles: ["i9"],
        optimalMoves: 3,
      }),
    ).toThrow(RangeError);
  });

  it("accepts captureTargets and includes them in output", () => {
    const lab = defineLabyrinth({
      id: "pawn-lab-6",
      start: "a2",
      target: "d7",
      obstacles: ["a3", "a4"],
      captureTargets: ["b3", "c4"],
      isCapture: true,
      optimalMoves: 5,
    });
    expect(lab.captureTargets).toEqual([
      { file: 1, rank: 2 },
      { file: 2, rank: 3 },
    ]);
  });

  it("omits captureTargets when not provided", () => {
    const lab = defineLabyrinth({
      id: "pawn-lab-7",
      start: "a2",
      target: "d7",
      optimalMoves: 5,
    });
    expect(lab.captureTargets).toBeUndefined();
  });

  it("throws when captureTarget overlaps start", () => {
    expect(() =>
      defineLabyrinth({
        id: "bad",
        start: "a2",
        target: "d7",
        captureTargets: ["a2"],
        optimalMoves: 3,
      }),
    ).toThrow("overlaps start");
  });

  it("throws when captureTarget overlaps target", () => {
    expect(() =>
      defineLabyrinth({
        id: "bad",
        start: "a2",
        target: "d7",
        captureTargets: ["d7"],
        optimalMoves: 3,
      }),
    ).toThrow("overlaps start, target, or obstacle");
  });

  it("throws when captureTarget overlaps obstacle", () => {
    expect(() =>
      defineLabyrinth({
        id: "bad",
        start: "a2",
        target: "d7",
        obstacles: ["a3"],
        captureTargets: ["a3"],
        optimalMoves: 3,
      }),
    ).toThrow("overlaps start, target, or obstacle");
  });

  it("throws on duplicate captureTargets", () => {
    expect(() =>
      defineLabyrinth({
        id: "bad",
        start: "a2",
        target: "d7",
        captureTargets: ["b3", "b3"],
        optimalMoves: 3,
      }),
    ).toThrow("Duplicate capture target");
  });
});
