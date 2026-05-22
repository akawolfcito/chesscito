import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getShareOrigin,
  shareUrlForBadge,
  shareUrlForDaily,
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
  it("returns the production fallback (www) when no env is set", () => {
    expect(getShareOrigin()).toBe("https://www.chesscito.com");
  });

  it("canonicalizes the apex env value to www to avoid the 307 hop", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://chesscito.com";
    expect(getShareOrigin()).toBe("https://www.chesscito.com");
  });

  it("leaves non-apex env values untouched (staging, preview, custom)", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://staging.chesscito.com";
    expect(getShareOrigin()).toBe("https://staging.chesscito.com");
  });

  it("strips a trailing slash from the env value", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://chesscito.com/";
    expect(getShareOrigin()).toBe("https://www.chesscito.com");
  });
});

describe("shareUrlForScore", () => {
  it("builds canonical URL with piece + stars params", () => {
    expect(shareUrlForScore({ piece: "rook", stars: 9 })).toBe(
      "https://www.chesscito.com/share/score?piece=rook&stars=9",
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
      "https://www.chesscito.com/share/badge?piece=rook&stars=15",
    );
  });

  it("supports all six piece kinds", () => {
    const pieces = ["rook", "bishop", "knight", "pawn", "queen", "king"] as const;
    for (const p of pieces) {
      expect(shareUrlForBadge({ piece: p, stars: 15 })).toContain(`piece=${p}`);
    }
  });
});

describe("shareUrlForDaily", () => {
  it("builds canonical URL with piece + name + start + target for the unsolved branch", () => {
    expect(
      shareUrlForDaily({
        piece: "rook",
        name: "Rook horizontal slide",
        start: "a1",
        target: "h1",
      }),
    ).toBe(
      "https://www.chesscito.com/share/daily?piece=rook&name=Rook+horizontal+slide&start=a1&target=h1",
    );
  });

  it("appends solved=true and a non-zero streak only when solved", () => {
    const solvedWithStreak = shareUrlForDaily({
      piece: "bishop",
      name: "Diagonal twins",
      start: "c1",
      target: "h6",
      solved: true,
      streak: 7,
    });
    expect(solvedWithStreak).toContain("solved=true");
    expect(solvedWithStreak).toContain("streak=7");

    const solvedNoStreak = shareUrlForDaily({
      piece: "knight",
      name: "L-shape hop",
      start: "b1",
      target: "c3",
      solved: true,
      streak: 0,
    });
    expect(solvedNoStreak).toContain("solved=true");
    expect(solvedNoStreak).not.toContain("streak=");

    const unsolved = shareUrlForDaily({
      piece: "knight",
      name: "L-shape hop",
      start: "b1",
      target: "c3",
      solved: false,
      streak: 5,
    });
    expect(unsolved).not.toContain("solved=");
    expect(unsolved).not.toContain("streak=");
  });

  it("normalizes squares to lowercase and falls back to a1 on invalid input", () => {
    expect(
      shareUrlForDaily({
        piece: "rook",
        name: "name",
        start: "A1",
        target: "H8",
      }),
    ).toContain("start=a1&target=h8");
    expect(
      shareUrlForDaily({
        piece: "rook",
        name: "name",
        start: "z9",
        target: "??",
      }),
    ).toContain("start=a1&target=a1");
  });

  it("truncates puzzle names beyond 40 chars and clamps streak to [0, 999]", () => {
    const longName = "x".repeat(80);
    const url = shareUrlForDaily({
      piece: "queen",
      name: longName,
      start: "d1",
      target: "d8",
      solved: true,
      streak: 5000,
    });
    expect(url).toContain(`name=${"x".repeat(40)}&`);
    expect(url).not.toContain("x".repeat(41));
    expect(url).toContain("streak=999");
  });

  it("rejects unknown piece kinds by defaulting to rook", () => {
    const url = shareUrlForDaily({
      // @ts-expect-error — runtime guard for stray callers
      piece: "wolf",
      name: "Surprise",
      start: "a1",
      target: "h8",
    });
    expect(url).toContain("piece=rook");
  });
});
