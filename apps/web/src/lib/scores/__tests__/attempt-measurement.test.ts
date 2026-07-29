/**
 * Attempt measurement bounds.
 *
 * Spec: docs/specs/2026-07-28-attempt-identity-score-attempts.md (v7, D12).
 * Each kind is bounded by ITS OWN quantity — `optimalMoves` is not a move count
 * in four of the seven buckets (catalog.ts:98-110), so one shared bound would be
 * meaningless for them.
 */

import { describe, expect, it } from "vitest";

import {
  isMeasurementInRange,
  parseAttemptMeasurement,
  MAX_ATTEMPT_FAILURES,
  MOVES_CEILING_FLOOR,
  movesCeiling,
  type AttemptMeasurement,
} from "../attempt-measurement";

describe("parseAttemptMeasurement — shape only", () => {
  it("accepts each of the three kinds", () => {
    expect(parseAttemptMeasurement({ kind: "moves", movesUsed: 4 })).toEqual({
      kind: "moves",
      movesUsed: 4,
    });
    expect(parseAttemptMeasurement({ kind: "failures", failures: 0 })).toEqual({
      kind: "failures",
      failures: 0,
    });
    expect(
      parseAttemptMeasurement({ kind: "coverage", reached: 10, ceiling: 63 }),
    ).toEqual({ kind: "coverage", reached: 10, ceiling: 63 });
  });

  it("drops fields the kind does not own", () => {
    // A `moves` payload carrying a ceiling must not smuggle it through: the
    // measurement's kind decides which columns exist, and an extra one would
    // violate the table's coherence constraint.
    expect(
      parseAttemptMeasurement({ kind: "moves", movesUsed: 4, ceiling: 63 }),
    ).toEqual({ kind: "moves", movesUsed: 4 });
  });

  it("rejects an unknown kind, a missing field and a non-object", () => {
    for (const v of [
      { kind: "vibes", n: 1 },
      { kind: "moves" },
      { kind: "coverage", reached: 1 },
      null,
      "moves",
      [{ kind: "moves", movesUsed: 1 }],
    ]) {
      expect(parseAttemptMeasurement(v)).toBeNull();
    }
  });

  it("rejects NaN, Infinity and fractions — shape, before any range", () => {
    for (const movesUsed of [Number.NaN, Number.POSITIVE_INFINITY, 2.5, "4"]) {
      expect(parseAttemptMeasurement({ kind: "moves", movesUsed })).toBeNull();
    }
  });

  it("accepts a value the RANGE gate will refuse", () => {
    // Deliberate: shape and range are separate answers. Collapsing them would
    // make a malformed body indistinguishable from an implausible run.
    const parsed = parseAttemptMeasurement({ kind: "moves", movesUsed: 0 });
    expect(parsed).toEqual({ kind: "moves", movesUsed: 0 });
    expect(isMeasurementInRange(parsed!, { movesCeiling: 60 })).toBe(false);
  });
});

describe("movesCeiling", () => {
  it("floors at 60 so short-optimal exercises keep headroom", () => {
    expect(movesCeiling(1)).toBe(MOVES_CEILING_FLOOR);
    expect(movesCeiling(7)).toBe(MOVES_CEILING_FLOOR);
  });

  it("scales at 8x once 8x clears the floor", () => {
    expect(movesCeiling(10)).toBe(80);
    expect(movesCeiling(20)).toBe(160);
  });
});

describe("isMeasurementInRange — moves", () => {
  const limits = { movesCeiling: movesCeiling(4) }; // 60

  it("accepts a plausible completion", () => {
    expect(isMeasurementInRange({ kind: "moves", movesUsed: 4 }, limits)).toBe(true);
    expect(isMeasurementInRange({ kind: "moves", movesUsed: 60 }, limits)).toBe(true);
  });

  it("rejects zero, negatives, fractions and NaN", () => {
    for (const movesUsed of [0, -1, 2.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(isMeasurementInRange({ kind: "moves", movesUsed }, limits)).toBe(false);
    }
  });

  it("rejects above the ceiling", () => {
    expect(isMeasurementInRange({ kind: "moves", movesUsed: 61 }, limits)).toBe(false);
  });
});

describe("isMeasurementInRange — failures", () => {
  it("accepts zero failures (a clean run)", () => {
    expect(isMeasurementInRange({ kind: "failures", failures: 0 }, {})).toBe(true);
  });

  it("accepts up to the absurdity bound", () => {
    expect(
      isMeasurementInRange({ kind: "failures", failures: MAX_ATTEMPT_FAILURES }, {}),
    ).toBe(true);
    expect(
      isMeasurementInRange({ kind: "failures", failures: MAX_ATTEMPT_FAILURES + 1 }, {}),
    ).toBe(false);
  });

  it("rejects negatives and fractions", () => {
    expect(isMeasurementInRange({ kind: "failures", failures: -1 }, {})).toBe(false);
    expect(isMeasurementInRange({ kind: "failures", failures: 1.5 }, {})).toBe(false);
  });
});

describe("isMeasurementInRange — coverage", () => {
  const limits = { coverageCeiling: 63 };

  it("accepts 0..ceiling, because a run below the pass line is a real 0-star run", () => {
    expect(isMeasurementInRange({ kind: "coverage", reached: 0, ceiling: 63 }, limits)).toBe(true);
    expect(isMeasurementInRange({ kind: "coverage", reached: 63, ceiling: 63 }, limits)).toBe(true);
  });

  it("rejects reaching more than the ceiling", () => {
    expect(isMeasurementInRange({ kind: "coverage", reached: 64, ceiling: 63 }, limits)).toBe(false);
  });

  it("rejects a ceiling that disagrees with the catalogue's", () => {
    // The catalogue's ceiling is authoritative; a client-supplied one is not
    // trusted. The tour's is documented as an upper bound, not exact.
    expect(isMeasurementInRange({ kind: "coverage", reached: 10, ceiling: 99 }, limits)).toBe(false);
  });

  it("rejects when no catalogue ceiling was supplied", () => {
    const m: AttemptMeasurement = { kind: "coverage", reached: 10, ceiling: 63 };
    expect(isMeasurementInRange(m, {})).toBe(false);
  });
});
