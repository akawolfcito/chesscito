import { describe, expect, it } from "vitest";

import type { BuilderState } from "../state";
import { validateBuilder } from "../validate";

const base = (overrides: Partial<BuilderState>): BuilderState => ({
  piece: "rook",
  start: "a1",
  goal: "a8",
  walls: [],
  captures: [],
  order: 0,
  ...overrides,
});

describe("validateBuilder", () => {
  it("returns ok + optimal + path for a solvable rook lab", () => {
    const result = validateBuilder(base({}));
    expect(result.ok).toBe(true);
    expect(result.optimalMoves).toBe(1);
    expect(result.path).toHaveLength(2);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("errors when start === goal", () => {
    const result = validateBuilder(base({ start: "a1", goal: "a1" }));
    expect(result.ok).toBe(false);
    expect(result.optimalMoves).toBeNull();
    expect(result.errors.some((e) => /start/i.test(e))).toBe(true);
  });

  it("errors when start is missing", () => {
    const result = validateBuilder(base({ start: null }));
    expect(result.ok).toBe(false);
    expect(result.optimalMoves).toBeNull();
    expect(result.errors.some((e) => /start/i.test(e))).toBe(true);
  });

  it("warns about a shortcut when the traced route is longer than the optimal", () => {
    const result = validateBuilder(base({}), ["a1", "b1", "b8", "a8"]);
    expect(result.ok).toBe(true);
    expect(result.optimalMoves).toBe(1);
    expect(result.warnings.some((w) => /shorter|shortcut/i.test(w))).toBe(true);
  });

  it("does not warn when the traced route already matches the optimal", () => {
    const result = validateBuilder(base({}), ["a1", "a8"]);
    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it("errors when the position is unsolvable (knight boxed in the corner)", () => {
    const result = validateBuilder(
      base({ piece: "knight", start: "a1", goal: "h8", walls: ["b3", "c2"], captures: [] }),
    );
    expect(result.ok).toBe(false);
    expect(result.optimalMoves).toBeNull();
    expect(result.errors.some((e) => /unreachable/i.test(e))).toBe(true);
  });

  it("validates a solvable pawn lab", () => {
    const result = validateBuilder(
      base({ piece: "pawn", start: "a2", goal: "a4", walls: [], captures: [] }),
    );
    expect(result.ok).toBe(true);
    expect(result.optimalMoves).not.toBeNull();
    expect(result.path.length).toBeGreaterThanOrEqual(2);
  });
});
