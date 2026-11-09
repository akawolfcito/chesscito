import { describe, it, expect } from "vitest";
import { validateGameRecord } from "../validate-game.js";

describe("validateGameRecord", () => {
  it("accepts a valid scholar's mate (checkmate + win)", () => {
    const result = validateGameRecord({
      moves: ["e4", "e5", "Qh5", "Nc6", "Bc4", "Nf6", "Qxf7#"],
      result: "win",
      difficulty: "easy",
    });
    expect(result.valid).toEqual(true);
    if (result.valid) {
      expect(result.computedResult).toEqual("win");
      expect(result.totalMoves).toEqual(7);
    }
  });

  it("rejects illegal move sequence", () => {
    const result = validateGameRecord({
      moves: ["e4", "e5", "e4"],
      result: "win",
      difficulty: "easy",
    });
    expect(result.valid).toEqual(false);
    if (!result.valid) {
      expect(result.error.includes("Illegal move")).toBeTruthy();
    }
  });

  it("corrects mismatched result claim", () => {
    const result = validateGameRecord({
      moves: ["e4", "e5", "Qh5", "Nc6", "Bc4", "Nf6", "Qxf7#"],
      result: "draw",
      difficulty: "easy",
    });
    expect(result.valid).toEqual(true);
    if (result.valid) {
      expect(result.computedResult).toEqual("win");
    }
  });

  it("rejects empty moves", () => {
    const result = validateGameRecord({
      moves: [],
      result: "draw",
      difficulty: "easy",
    });
    expect(result.valid).toEqual(false);
  });

  it("accepts a valid resignation (non-terminal position)", () => {
    const result = validateGameRecord({
      moves: ["e4", "e5", "Nf3"],
      result: "resigned",
      difficulty: "medium",
    });
    expect(result.valid).toEqual(true);
    if (result.valid) {
      expect(result.computedResult).toEqual("resigned");
    }
  });
});
