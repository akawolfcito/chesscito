/**
 * Star Sweep decoding — the authored `targets` become board positions, and the
 * invariant that keeps every pre-Sweep reader correct is enforced here rather
 * than trusted.
 */
import { describe, expect, it } from "vitest";

import { FenError, mapFenPuzzle, squareToPos } from "@/lib/game/fen-puzzle";

const rookOnE2 = "8/8/8/8/8/8/4R3/8 w - - 0 1";

const input = (over: Record<string, unknown> = {}) =>
  ({
    kind: "exercise" as const,
    piece: "rook" as const,
    fen: rookOnE2,
    mover: "e2",
    target: "e8",
    tier: "easy" as const,
    ...over,
  }) as Parameters<typeof mapFenPuzzle>[0];

describe("mapFenPuzzle — targets", () => {
  it("leaves `targets` undefined for a plain exercise", () => {
    expect(mapFenPuzzle(input()).targets).toBeUndefined();
  });

  it("decodes every authored square in order", () => {
    const mapped = mapFenPuzzle(input({ targets: ["e8", "b8", "b5"] }));
    expect(mapped.targets).toEqual([
      squareToPos("e8"),
      squareToPos("b8"),
      squareToPos("b5"),
    ]);
  });

  it("keeps targetPos pointing at the first target", () => {
    // The invariant that lets 100+ legacy readers keep working unchanged.
    const mapped = mapFenPuzzle(input({ targets: ["e8", "b8"] }));
    expect(mapped.targetPos).toEqual(mapped.targets![0]);
    expect(mapped.targetPos).toEqual(squareToPos("e8"));
  });

  it("rejects a `target` that disagrees with targets[0]", () => {
    // Would grade against one square while the board highlights another, and
    // both would look right in review.
    expect(() => mapFenPuzzle(input({ target: "e8", targets: ["b8", "e8"] }))).toThrow(
      FenError,
    );
  });

  it("rejects a single-square sweep", () => {
    expect(() => mapFenPuzzle(input({ targets: ["e8"] }))).toThrow(/at least two/i);
  });

  it("rejects a repeated square", () => {
    expect(() => mapFenPuzzle(input({ targets: ["e8", "b8", "e8"] }))).toThrow(/repeats/i);
  });

  it("rejects a target standing on the start square", () => {
    // Collecting it would be free and the optimum would be a lie.
    expect(() => mapFenPuzzle(input({ targets: ["e8", "e2"] }))).toThrow(/start square/i);
  });

  it("rejects `targets` on a kind that has no destination", () => {
    expect(() =>
      mapFenPuzzle(
        input({
          kind: "knight-tour",
          piece: "knight",
          fen: "8/8/8/8/8/8/4N3/8 w - - 0 1",
          mover: "e2",
          target: undefined,
          targets: ["e8", "b8"],
        }),
      ),
    ).toThrow(/no destination/i);
  });

  it("ignores blank entries rather than decoding them", () => {
    const mapped = mapFenPuzzle(input({ targets: ["e8", "  ", "b8"] }));
    expect(mapped.targets).toHaveLength(2);
  });
});

describe("mapFenPuzzle — starFloor", () => {
  it("is absent when the board declares no policy", () => {
    expect(mapFenPuzzle(input()).starFloor).toBeUndefined();
  });

  it("carries a valid floor through", () => {
    expect(mapFenPuzzle(input({ starFloor: 1 })).starFloor).toBe(1);
    expect(mapFenPuzzle(input({ starFloor: 2 })).starFloor).toBe(2);
  });

  it("rejects a floor of 3 — an unfailable board is the flatness we removed", () => {
    expect(() => mapFenPuzzle(input({ starFloor: 3 }))).toThrow(/must be 1 or 2/i);
  });

  it("rejects a nonsense floor instead of dropping it", () => {
    // Silently dropping a typo would leave the front-of-funnel board unprotected
    // with nothing to notice.
    expect(() => mapFenPuzzle(input({ starFloor: 0 }))).toThrow(FenError);
    expect(() => mapFenPuzzle(input({ starFloor: 1.5 }))).toThrow(FenError);
  });
});
