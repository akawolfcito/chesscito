import { describe, expect, it } from "vitest";

import { PUZZLE_KINDS, isThreatKind, squareToPos, type PuzzleKind } from "@/lib/game/fen-puzzle";
import { attackedSquares } from "@/lib/game/attack-map";
import type { BuilderState } from "../state";
import {
  KIND_CAPABILITY,
  isKindEditable,
  kindLabel,
  watchedSquares,
} from "../authoring";

describe("KIND_CAPABILITY", () => {
  it("covers every PuzzleKind, no more no less", () => {
    expect(Object.keys(KIND_CAPABILITY).sort()).toEqual([...PUZZLE_KINDS].sort());
  });

  it("opens every kind for editing — Safe Path included, from its own stage", () => {
    for (const kind of PUZZLE_KINDS) {
      expect(isKindEditable(kind)).toBe(true);
    }
  });

  it("offers the enemy brush exactly to the threat kinds, always without the king", () => {
    for (const kind of PUZZLE_KINDS) {
      const pieces = KIND_CAPABILITY[kind].enemyPieces;
      if (isThreatKind(kind)) {
        expect(pieces).toHaveLength(5);
        expect(pieces).not.toContain("king");
      } else {
        expect(pieces).toEqual([]);
      }
    }
  });

  it("labels every kind", () => {
    for (const kind of PUZZLE_KINDS) {
      expect(kindLabel(kind as PuzzleKind).length).toBeGreaterThan(0);
    }
  });
});

describe("watchedSquares (AC-9)", () => {
  const draft = (over: Partial<BuilderState>): BuilderState => ({
    kind: "safe-path", piece: "king", start: "a1", goal: "h8",
    walls: [], enemies: [], order: 0, ...over,
  });

  it("marks EXACTLY the squares the game's attackedSquares computes", () => {
    const state = draft({
      walls: ["d5"],
      enemies: [{ square: "d4", piece: "knight" }, { square: "f6", piece: "rook" }],
    });
    const typed = state.enemies.map((e) => ({ pos: squareToPos(e.square), piece: e.piece }));
    expect(watchedSquares(state)).toEqual(attackedSquares(typed, [squareToPos("d5")]));
  });

  it("is empty for a non-threat kind even with black pieces on the board", () => {
    expect(
      watchedSquares(draft({ kind: "labyrinth", enemies: [{ square: "d4", piece: "knight" }] })),
    ).toEqual(new Set());
  });
});
