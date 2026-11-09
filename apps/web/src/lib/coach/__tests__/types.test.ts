import { describe, it, expect } from "vitest";
import { toCoachGameResult, type CoachGameResult } from "../types.js";

describe("toCoachGameResult", () => {
  it("accepts each of the four canonical values unchanged", () => {
    const inputs: CoachGameResult[] = ["win", "lose", "draw", "resigned"];
    for (const input of inputs) {
      expect(toCoachGameResult(input)).toEqual(input);
    }
  });

  it("throws on unknown string input — no silent coercion", () => {
    expect(() => toCoachGameResult("loss")).toThrowError(/CoachGameResult/);
    expect(() => toCoachGameResult("WIN")).toThrowError(/CoachGameResult/);
    expect(() => toCoachGameResult("")).toThrowError(/CoachGameResult/);
  });

  it("throws on non-string input", () => {
    expect(() => toCoachGameResult(undefined)).toThrowError(/CoachGameResult/);
    expect(() => toCoachGameResult(null)).toThrowError(/CoachGameResult/);
    expect(() => toCoachGameResult(0)).toThrowError(/CoachGameResult/);
  });
});
