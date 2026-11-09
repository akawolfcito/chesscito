import { describe, it, expect } from "vitest";
import { endgameStars, computeStars, totalStars } from "../scoring";

describe("endgameStars", () => {
  it("returns 3 stars for <= 10 moves", () => {
    expect(endgameStars(7, 16)).toBe(3);
    expect(endgameStars(10, 16)).toBe(3);
  });

  it("returns 2 stars for > 10 but <= parMoves", () => {
    expect(endgameStars(11, 16)).toBe(2);
    expect(endgameStars(14, 16)).toBe(2);
    expect(endgameStars(16, 16)).toBe(2);
  });

  it("returns 1 star for > parMoves", () => {
    expect(endgameStars(17, 16)).toBe(1);
    expect(endgameStars(20, 16)).toBe(1);
    expect(endgameStars(99, 16)).toBe(1);
  });

  it("uses parMoves parameter correctly", () => {
    expect(endgameStars(12, 20)).toBe(2);
    expect(endgameStars(21, 20)).toBe(1);
  });
});
