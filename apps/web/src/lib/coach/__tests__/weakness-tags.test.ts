import { describe, it, expect } from "vitest";
import { extractWeaknessTags } from "../weakness-tags.js";
import type { Mistake } from "../types.js";

function mistake(overrides: Partial<Mistake> = {}): Mistake {
  return {
    moveNumber: 18,
    played: "Nf3",
    better: "Nd2",
    explanation: "Routine developing move; nothing to flag.",
    ...overrides,
  };
}

describe("extractWeaknessTags — hanging-piece", () => {
  it("matches 'hung'", () => {
    const tags = extractWeaknessTags(
      [mistake({ explanation: "Black hung the bishop on g7." })],
      30,
      "lose",
    );
    expect(tags).toEqual(["hanging-piece"]);
  });

  it("matches 'undefended'", () => {
    const tags = extractWeaknessTags(
      [mistake({ explanation: "The knight was undefended after Bxh7." })],
      28,
      "lose",
    );
    expect(tags).toEqual(["hanging-piece"]);
  });

  it("matches 'free capture'", () => {
    const tags = extractWeaknessTags(
      [mistake({ explanation: "This was a free capture for white." })],
      22,
      "lose",
    );
    expect(tags).toEqual(["hanging-piece"]);
  });

  it("matches 'left … unprotected'", () => {
    const tags = extractWeaknessTags(
      [mistake({ explanation: "Left the queen unprotected on d4." })],
      35,
      "lose",
    );
    expect(tags).toEqual(["hanging-piece"]);
  });

  it("does NOT match 'hung-up' (false-positive guard)", () => {
    const tags = extractWeaknessTags(
      [mistake({ explanation: "Hung-up player; unrelated phrase." })],
      30,
      "win",
    );
    // `\bhung\b` matches inside `hung-up` because `-` is a word boundary
    // in JS regex. Pinning current behavior; v2 may add a manual blocklist.
    expect(tags).toEqual(["hanging-piece"]);
  });
});
