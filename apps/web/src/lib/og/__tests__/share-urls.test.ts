import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getShareOrigin,
  shareUrlForBadge,
  shareUrlForScore,
} from "@/lib/og/share-urls";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_APP_URL;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("getShareOrigin", () => {
  it("returns the production fallback when no env is set", () => {
    expect(getShareOrigin()).toBe("https://chesscito.com");
  });

  it("prefers NEXT_PUBLIC_APP_URL when present", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://staging.chesscito.com";
    expect(getShareOrigin()).toBe("https://staging.chesscito.com");
  });

  it("strips a trailing slash from the env value", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://chesscito.com/";
    expect(getShareOrigin()).toBe("https://chesscito.com");
  });
});

describe("shareUrlForScore", () => {
  it("builds canonical URL with piece + stars params", () => {
    expect(shareUrlForScore({ piece: "rook", stars: 9 })).toBe(
      "https://chesscito.com/share/score?piece=rook&stars=9",
    );
  });

  it("clamps stars into [0, 15]", () => {
    expect(shareUrlForScore({ piece: "bishop", stars: -1 })).toContain("stars=0");
    expect(shareUrlForScore({ piece: "bishop", stars: 999 })).toContain("stars=15");
  });

  it("rejects unknown piece kinds by defaulting to rook", () => {
    // @ts-expect-error — runtime guard for stray callers
    expect(shareUrlForScore({ piece: "wolf", stars: 5 })).toContain("piece=rook");
  });
});

describe("shareUrlForBadge", () => {
  it("builds canonical URL with piece + stars params", () => {
    expect(shareUrlForBadge({ piece: "rook", stars: 15 })).toBe(
      "https://chesscito.com/share/badge?piece=rook&stars=15",
    );
  });

  it("supports all six piece kinds", () => {
    const pieces = ["rook", "bishop", "knight", "pawn", "queen", "king"] as const;
    for (const p of pieces) {
      expect(shareUrlForBadge({ piece: p, stars: 15 })).toContain(`piece=${p}`);
    }
  });
});
