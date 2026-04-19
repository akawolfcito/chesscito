import { describe, it, expect } from "vitest";
import { normalizeCoachResponse } from "../normalize.js";

describe("normalizeCoachResponse", () => {
  it("accepts a valid full response", () => {
    const raw = {
      kind: "full",
      summary: "Good game.",
      mistakes: [{ moveNumber: 3, played: "Qh5", better: "Nf3", explanation: "Develop first" }],
      lessons: ["Castle early"],
      praise: ["Good opening"],
    };
    const result = normalizeCoachResponse(raw);
    expect(result.success).toEqual(true);
    if (result.success) {
      expect(result.data.kind).toEqual("full");
      expect(result.data.mistakes.length).toEqual(1);
    }
  });

  it("rejects response missing kind", () => {
    const raw = { summary: "test", mistakes: [], lessons: [], praise: [] };
    const result = normalizeCoachResponse(raw);
    expect(result.success).toEqual(false);
  });

  it("rejects summary over 500 chars", () => {
    const raw = {
      kind: "full",
      summary: "x".repeat(600),
      mistakes: [],
      lessons: [],
      praise: [],
    };
    const result = normalizeCoachResponse(raw);
    expect(result.success).toEqual(false);
  });

  it("caps mistakes at 10", () => {
    const mistakes = Array.from({ length: 15 }, (_, i) => ({
      moveNumber: i + 1,
      played: "e4",
      better: "d4",
      explanation: "test",
    }));
    const raw = { kind: "full", summary: "test", mistakes, lessons: [], praise: [] };
    const result = normalizeCoachResponse(raw);
    expect(result.success).toEqual(true);
    if (result.success) {
      expect(result.data.mistakes.length <= 10).toBeTruthy();
    }
  });

  it("returns failure for completely invalid data", () => {
    const result = normalizeCoachResponse("not an object");
    expect(result.success).toEqual(false);
  });
});
