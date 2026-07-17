import { describe, expect, it } from "vitest";

import { PUZZLE_KINDS, isThreatKind, type PuzzleKind } from "@/lib/game/fen-puzzle";
import {
  KIND_CAPABILITY,
  isKindEditable,
  kindLabel,
} from "../authoring";

describe("KIND_CAPABILITY", () => {
  it("covers every PuzzleKind, no more no less", () => {
    expect(Object.keys(KIND_CAPABILITY).sort()).toEqual([...PUZZLE_KINDS].sort());
  });

  it("keeps Safe Path off-limits until its own stage; everything else opens", () => {
    for (const kind of PUZZLE_KINDS) {
      expect(isKindEditable(kind)).toBe(kind !== "safe-path");
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
