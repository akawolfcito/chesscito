import { describe, expect, it } from "vitest";

import { EXERCISES } from "@/lib/game/exercises";
import { parsePieceStars } from "@/lib/exercises/badge-progress";

const ROOK_POOL = EXERCISES.rook.length;

function idKeyed(entries: Record<string, number>): string {
  return JSON.stringify({ piece: "rook", currentId: "rook-1", stars: entries });
}

describe("parsePieceStars — id-keyed progress (the shape the app writes since 2026-06-16)", () => {
  it("sums an id-keyed record instead of reading it as a positional array", () => {
    // 6 exercises × 3★ = 18★ — the founder's real rook progress, which the
    // badge sheet was scoring as 0 because Array.isArray({...}) is false.
    const raw = idKeyed({
      "rook-1": 3,
      "rook-2": 3,
      "rook-distance-1": 3,
      "rook-4": 3,
      "rook-no-diagonal-1": 3,
      "rook-6": 3,
    });

    const stars = parsePieceStars(raw, "rook");

    expect(stars).toHaveLength(ROOK_POOL);
    expect(stars.reduce((a, b) => a + b, 0)).toBe(18);
  });

  it("orders values by catalog position, not by object key order", () => {
    const raw = idKeyed({ "rook-distance-1": 3, "rook-1": 1 });

    const stars = parsePieceStars(raw, "rook");

    expect(stars[0]).toBe(1);
    expect(stars[1]).toBe(0);
    expect(stars[2]).toBe(3);
  });

  it("ignores ids that are not in the piece pool", () => {
    const raw = idKeyed({ "rook-1": 3, "knight-1": 3, "bogus": 3 });

    expect(parsePieceStars(raw, "rook").reduce((a, b) => a + b, 0)).toBe(3);
  });

  it("clamps out-of-range and non-numeric values", () => {
    const raw = idKeyed({ "rook-1": 99, "rook-2": -5 });
    const stars = parsePieceStars(raw, "rook");

    expect(stars[0]).toBe(3);
    expect(stars[1]).toBe(0);
  });
});

describe("parsePieceStars — legacy positional progress", () => {
  it("still reads a legacy stars array, padded to the current pool length", () => {
    const raw = JSON.stringify({ piece: "rook", exerciseIndex: 0, stars: [3, 3, 3, 3, 3] });

    const stars = parsePieceStars(raw, "rook");

    expect(stars).toHaveLength(ROOK_POOL);
    expect(stars.reduce((a, b) => a + b, 0)).toBe(15);
  });
});

describe("parsePieceStars — absent or corrupt progress", () => {
  it.each([
    ["missing entry", null],
    ["invalid JSON", "{not json"],
    ["no stars field", JSON.stringify({ piece: "rook" })],
    ["stars is a string", JSON.stringify({ piece: "rook", stars: "18" })],
  ])("returns a zeroed pool-length array for %s", (_label, raw) => {
    const stars = parsePieceStars(raw, "rook");

    expect(stars).toHaveLength(ROOK_POOL);
    expect(stars.every((s) => s === 0)).toBe(true);
  });
});
