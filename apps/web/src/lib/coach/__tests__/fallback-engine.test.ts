import { describe, it, expect } from "vitest";
import { generateQuickReview } from "../fallback-engine.js";

describe("generateQuickReview", () => {
  it("returns kind quick", () => {
    const result = generateQuickReview({
      result: "win",
      difficulty: "easy",
      totalMoves: 12,
      elapsedMs: 30000,
    });
    expect(result.kind).toEqual("quick");
  });

  it("generates summary for a win", () => {
    const result = generateQuickReview({
      result: "win",
      difficulty: "easy",
      totalMoves: 12,
      elapsedMs: 30000,
    });
    expect(result.summary.length > 0).toBeTruthy();
  });

  it("suggests harder difficulty on easy win", () => {
    const result = generateQuickReview({
      result: "win",
      difficulty: "easy",
      totalMoves: 10,
      elapsedMs: 20000,
    });
    expect(result.tips.some((t) => t.toLowerCase().includes("medium") || t.toLowerCase().includes("harder"))).toBeTruthy();
  });

  it("encourages on a loss", () => {
    const result = generateQuickReview({
      result: "lose",
      difficulty: "hard",
      totalMoves: 40,
      elapsedMs: 120000,
    });
    expect(result.summary.length > 0).toBeTruthy();
    expect(result.tips.length > 0).toBeTruthy();
  });

  it("handles resigned result", () => {
    const result = generateQuickReview({
      result: "resigned",
      difficulty: "medium",
      totalMoves: 15,
      elapsedMs: 45000,
    });
    expect(result.kind).toEqual("quick");
    expect(result.tips.length > 0).toBeTruthy();
  });
});
