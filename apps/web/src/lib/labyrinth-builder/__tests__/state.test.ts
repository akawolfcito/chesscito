import { describe, expect, it } from "vitest";

import { mapFenPuzzle } from "@/lib/game/fen-puzzle";

import {
  buildFenBlock,
  emptyState,
  extraFields,
  toLabyrinthRecord,
  toPuzzleInput,
  type BuilderState,
} from "../state";

describe("labyrinth-builder/state", () => {
  describe("emptyState", () => {
    it("defaults to a rook with empty endpoints and collections", () => {
      const s = emptyState();
      expect(s).toEqual({
        kind: "labyrinth",
        piece: "rook",
        start: null,
        goal: null,
        walls: [],
        enemies: [],
        order: 0,
      });
    });

    it("honours an explicit piece argument", () => {
      expect(emptyState("knight").piece).toBe("knight");
    });
  });

  describe("toPuzzleInput", () => {
    it("emits a labyrinth puzzle and round-trips through mapFenPuzzle", () => {
      const s: BuilderState = {
        kind: "labyrinth",
        piece: "rook",
        start: "a1",
        goal: "a8",
        walls: ["h1"],
        enemies: [],
        order: 0,
      };

      const puzzle = toPuzzleInput(s);
      expect(puzzle.kind).toBe("labyrinth");
      expect(puzzle.mover).toBe("a1");
      expect(puzzle.target).toBe("a8");
      // 8 ranks => 7 slashes in the placement field
      expect(puzzle.fen.split(" ")[0].split("/")).toHaveLength(8);
      expect(puzzle.fen).toContain("/");

      const mapped = mapFenPuzzle(puzzle);
      expect(mapped.startPos).toEqual({ file: 0, rank: 0 }); // a1
      expect(mapped.targetPos).toEqual({ file: 0, rank: 7 }); // a8
      expect(mapped.obstacles).toContainEqual({ file: 7, rank: 0 }); // h1 wall
    });
  });

  describe("buildFenBlock", () => {
    it("always returns mover === start (B5)", () => {
      const s: BuilderState = {
        kind: "labyrinth",
        piece: "rook",
        start: "d4",
        goal: "d8",
        walls: ["a1", "h8"],
        enemies: [],
        order: 0,
      };
      expect(buildFenBlock(s).mover).toBe("d4");
    });

    it("disambiguates a knight mover from knight walls via explicit mover (B5)", () => {
      // A knight lesson where the walls are ALSO white knights. Without an
      // explicit mover this FEN has 3 white knights => "ambiguous mover".
      const s: BuilderState = {
        kind: "labyrinth",
        piece: "knight",
        start: "b1",
        goal: "f7",
        walls: ["c3", "e5"],
        enemies: [],
        order: 0,
      };

      const block = buildFenBlock(s);
      expect(block.mover).toBe("b1");

      const puzzle = toPuzzleInput(s);
      expect(() => mapFenPuzzle(puzzle)).not.toThrow();

      const mapped = mapFenPuzzle(puzzle);
      expect(mapped.startPos).toEqual({ file: 1, rank: 0 }); // b1
      expect(mapped.obstacles).toContainEqual({ file: 2, rank: 2 }); // c3
      expect(mapped.obstacles).toContainEqual({ file: 4, rank: 4 }); // e5
    });

    it("throws when start is null", () => {
      const s = { ...emptyState(), goal: "a8" };
      expect(() => buildFenBlock(s)).toThrow("start and goal required");
    });

    it("throws when goal is null", () => {
      const s = { ...emptyState(), start: "a1" };
      expect(() => buildFenBlock(s)).toThrow("start and goal required");
    });
  });

  describe("teaching guide (authoring-only pedagogy)", () => {
    // The founder authors "what this teaches" in the builder now. These two
    // fields are UI-owned so a load→edit→save round-trips them from state,
    // instead of only surviving as opaque extraFields the UI never shows.
    const withGuide: BuilderState = {
      kind: "labyrinth",
      piece: "rook",
      start: "a1",
      goal: "a8",
      walls: [],
      enemies: [],
      order: 0,
      principle: "rank-movement",
      learningObjective: "The rook travels any distance along one rank.",
    };

    it("toLabyrinthRecord emits principle and learningObjective from state", () => {
      const rec = toLabyrinthRecord(withGuide);
      expect(rec.principle).toBe("rank-movement");
      expect(rec.learningObjective).toBe(
        "The rook travels any distance along one rank.",
      );
    });

    it("extraFields no longer carries them — the UI owns them now", () => {
      const extras = extraFields({
        id: "rook-1",
        piece: "rook",
        principle: "rank-movement",
        learningObjective: "Anything.",
        title: "Along the Rank",
        playerPrompt: "Slide straight to the star.",
      });
      // UI-owned → the builder's edit wins, not the loaded copy.
      expect(extras).not.toHaveProperty("principle");
      expect(extras).not.toHaveProperty("learningObjective");
      // Player-facing copy the builder still cannot express stays a passenger.
      expect(extras.title).toBe("Along the Rank");
      expect(extras.playerPrompt).toBe("Slide straight to the star.");
    });
  });

  describe("pawn captures", () => {
    it("emits a lowercase black pawn and maps to captureTargets + isCapture", () => {
      const s: BuilderState = {
        kind: "labyrinth",
        piece: "pawn",
        start: "d2",
        goal: "e3",
        walls: [],
        enemies: [{ square: "e3", piece: "pawn" }],
        order: 0,
      };

      const puzzle = toPuzzleInput(s);
      expect(puzzle.fen.split(" ")[0]).toContain("p"); // black pawn present

      const mapped = mapFenPuzzle(puzzle);
      expect(mapped.captureTargets).toContainEqual({ file: 4, rank: 2 }); // e3
      expect(mapped.isCapture).toBe(true);
    });
  });
});
