/**
 * Sprint 4 commit C — spend-service pure helper tests.
 */

import { describe, expect, it } from "vitest";

import {
  hasSpendIdempotencyPrefix,
  isPeonesSpendTarget,
  sanitizeSpendMetadata,
  SPEND_COST_BY_TARGET,
  SPEND_IDEMPOTENCY_PREFIX_BY_TARGET,
  SPEND_METADATA_WHITELIST,
} from "@/lib/peones/spend-service";

describe("isPeonesSpendTarget", () => {
  it("accepts the four Sprint 4 targets", () => {
    expect(isPeonesSpendTarget("coach")).toBe(true);
    expect(isPeonesSpendTarget("hint")).toBe(true);
    expect(isPeonesSpendTarget("retry")).toBe(true);
    expect(isPeonesSpendTarget("save_game")).toBe(true);
  });

  it("accepts shield", () => {
    expect(isPeonesSpendTarget("shield")).toBe(true);
  });

  it("rejects labyrinth_key (Sprint 5)", () => {
    expect(isPeonesSpendTarget("labyrinth_key")).toBe(false);
  });

  it("rejects unrelated strings", () => {
    expect(isPeonesSpendTarget("daily_tactic")).toBe(false);
    expect(isPeonesSpendTarget("")).toBe(false);
    expect(isPeonesSpendTarget("COACH")).toBe(false);
  });
});

describe("SPEND_COST_BY_TARGET", () => {
  it("matches calibration §5 defaults", () => {
    expect(SPEND_COST_BY_TARGET).toEqual({
      coach: 1,
      hint: 1,
      retry: 2,
      save_game: 1,
      shield: 2,
    });
  });
});

describe("hasSpendIdempotencyPrefix", () => {
  it("accepts correctly-prefixed keys per target", () => {
    expect(
      hasSpendIdempotencyPrefix("coach", "spend:coach:0xabc:game-1"),
    ).toBe(true);
    expect(
      hasSpendIdempotencyPrefix("hint", "spend:hint:0xabc:rook:r-1:3"),
    ).toBe(true);
    expect(
      hasSpendIdempotencyPrefix("retry", "spend:retry:0xabc:queen:q-2:7"),
    ).toBe(true);
    expect(
      hasSpendIdempotencyPrefix("save_game", "spend:save_game:0xabc:g-99"),
    ).toBe(true);
    expect(
      hasSpendIdempotencyPrefix("shield", "spend:shield:0xabc:5"),
    ).toBe(true);
  });

  it("rejects cross-target prefix collisions", () => {
    expect(
      hasSpendIdempotencyPrefix("hint", "spend:coach:0xabc:g-1"),
    ).toBe(false);
    expect(
      hasSpendIdempotencyPrefix("coach", "spend:hint:0xabc:rook:r-1:3"),
    ).toBe(false);
    expect(
      hasSpendIdempotencyPrefix("shield", "spend:coach:0xabc:5"),
    ).toBe(false);
  });

  it("rejects keys missing the prefix entirely", () => {
    expect(hasSpendIdempotencyPrefix("hint", "hint:0xabc:r-1")).toBe(false);
    expect(hasSpendIdempotencyPrefix("coach", "")).toBe(false);
  });

  it("each declared prefix is exactly spend:<target>:", () => {
    expect(SPEND_IDEMPOTENCY_PREFIX_BY_TARGET).toEqual({
      coach: "spend:coach:",
      hint: "spend:hint:",
      retry: "spend:retry:",
      save_game: "spend:save_game:",
      shield: "spend:shield:",
    });
  });
});

describe("sanitizeSpendMetadata", () => {
  it("keeps whitelisted primitive values", () => {
    const out = sanitizeSpendMetadata({
      difficulty: "easy",
      attemptSeq: 3,
      gameId: "g-1",
      piece: "rook",
      exerciseId: "r-1",
      surface: "exercises",
    });
    expect(out).toEqual({
      difficulty: "easy",
      attemptSeq: 3,
      gameId: "g-1",
      piece: "rook",
      exerciseId: "r-1",
      surface: "exercises",
    });
  });

  it("drops unknown keys silently", () => {
    const out = sanitizeSpendMetadata({
      gameId: "g-1",
      secret: "do-not-store",
      password: "x",
      __proto__: "bad",
    });
    expect(out).toEqual({ gameId: "g-1" });
  });

  it("drops non-primitive values (nested objects, arrays, null)", () => {
    const out = sanitizeSpendMetadata({
      gameId: "g-1",
      difficulty: { nested: "no" },
      attemptSeq: null,
      piece: ["array"],
    });
    expect(out).toEqual({ gameId: "g-1" });
  });

  it("drops strings outside (0, 200] length", () => {
    const out = sanitizeSpendMetadata({
      gameId: "",
      piece: "a".repeat(201),
      surface: "valid",
    });
    expect(out).toEqual({ surface: "valid" });
  });

  it("drops non-finite numbers", () => {
    const out = sanitizeSpendMetadata({
      attemptSeq: Number.NaN,
      difficulty: "easy",
    });
    expect(out).toEqual({ difficulty: "easy" });
  });

  it("returns null when nothing survives", () => {
    expect(sanitizeSpendMetadata({ secret: "x", bogus: 1 })).toBeNull();
    expect(sanitizeSpendMetadata({})).toBeNull();
    expect(sanitizeSpendMetadata(null)).toBeNull();
    expect(sanitizeSpendMetadata(undefined)).toBeNull();
    expect(sanitizeSpendMetadata("string")).toBeNull();
    expect(sanitizeSpendMetadata([1, 2, 3])).toBeNull();
  });

  it("the whitelist is exactly the six documented keys", () => {
    expect(SPEND_METADATA_WHITELIST.size).toBe(6);
    for (const k of [
      "difficulty",
      "attemptSeq",
      "gameId",
      "piece",
      "exerciseId",
      "surface",
    ]) {
      expect(SPEND_METADATA_WHITELIST.has(k)).toBe(true);
    }
  });
});
