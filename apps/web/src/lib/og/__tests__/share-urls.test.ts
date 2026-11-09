import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getShareOrigin,
  shareUrlForBadge,
  shareUrlForDaily,
  shareUrlForEndgame,
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
  it("builds canonical URL with piece + stars + max params", () => {
    expect(shareUrlForScore({ piece: "rook", stars: 9, maxStars: 30 })).toBe(
      "https://www.chesscito.com/share/score?piece=rook&stars=9&max=30",
    );
  });

  it("clamps stars into [0, maxStars]", () => {
    expect(shareUrlForScore({ piece: "bishop", stars: -1, maxStars: 30 })).toContain("stars=0");
    expect(shareUrlForScore({ piece: "bishop", stars: 999, maxStars: 30 })).toContain("stars=30");
  });

  /* Regression (2026-07-09): the ceiling was hardcoded to 15 — half of the
   * real 10-exercise pool — so a 24★ share card advertised 15★. */
  it("does not clamp a real 10-exercise pool down to 15", () => {
    expect(shareUrlForScore({ piece: "rook", stars: 24, maxStars: 30 })).toContain("stars=24");
  });

  it("falls back to the baseline pool when maxStars is omitted", () => {
    expect(shareUrlForScore({ piece: "rook", stars: 24 })).toContain("stars=24");
    expect(shareUrlForScore({ piece: "rook", stars: 24 })).toContain("max=30");
  });

  it("rejects unknown piece kinds by defaulting to rook", () => {
    // @ts-expect-error — runtime guard for stray callers
    expect(shareUrlForScore({ piece: "wolf", stars: 5 })).toContain("piece=rook");
  });
});

describe("shareUrlForBadge", () => {
  it("builds canonical URL with piece + stars + max params", () => {
    expect(shareUrlForBadge({ piece: "rook", stars: 15, maxStars: 30 })).toBe(
      "https://www.chesscito.com/share/badge?piece=rook&stars=15&max=30",
    );
  });

  it("does not clamp a real 10-exercise pool down to 15", () => {
    expect(shareUrlForBadge({ piece: "rook", stars: 30, maxStars: 30 })).toContain("stars=30");
  });

  it("keeps maxStars inside a sane absolute ceiling", () => {
    // 100 exercises × 3★ is the pool cap; nothing above it is representable.
    expect(shareUrlForBadge({ piece: "rook", stars: 5, maxStars: 9_999 })).toContain("max=300");
    expect(shareUrlForBadge({ piece: "rook", stars: 5, maxStars: 0 })).toContain("max=3");
  });

  it("supports all six piece kinds", () => {
    const pieces = ["rook", "bishop", "knight", "pawn", "queen", "king"] as const;
    for (const p of pieces) {
      expect(shareUrlForBadge({ piece: p, stars: 15, maxStars: 30 })).toContain(`piece=${p}`);
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

describe("shareUrlForEndgame", () => {
  it("builds canonical URL with mode + name + wk + wr + bk for the unsolved branch", () => {
    expect(
      shareUrlForEndgame({
        name: "K+R vs K — corner mate",
        wk: "e1",
        wr: "a1",
        bk: "e8",
      }),
    ).toBe(
      "https://www.chesscito.com/share/endgame?mode=krk&name=K%2BR+vs+K+%E2%80%94+corner+mate&wk=e1&wr=a1&bk=e8",
    );
  });

  it("defaults mode to krk when omitted", () => {
    const url = shareUrlForEndgame({
      name: "x",
      wk: "a1",
      wr: "h1",
      bk: "e8",
    });
    expect(url).toContain("mode=krk");
  });

  it("appends solved=true with moves + limit only when solved, drops them otherwise", () => {
    const solved = shareUrlForEndgame({
      name: "x",
      wk: "a1",
      wr: "h1",
      bk: "e8",
      solved: true,
      moves: 7,
      limit: 12,
    });
    expect(solved).toContain("solved=true");
    expect(solved).toContain("moves=7");
    expect(solved).toContain("limit=12");

    const unsolved = shareUrlForEndgame({
      name: "x",
      wk: "a1",
      wr: "h1",
      bk: "e8",
      moves: 99,
      limit: 99,
    });
    expect(unsolved).not.toContain("solved=");
    expect(unsolved).not.toContain("moves=");
    expect(unsolved).not.toContain("limit=");
  });

  it("normalizes squares to lowercase and falls back to a1 on invalid input", () => {
    const url = shareUrlForEndgame({
      name: "x",
      wk: "A1",
      wr: "Z9",
      bk: "??",
    });
    expect(url).toContain("wk=a1");
    expect(url).toContain("wr=a1");
    expect(url).toContain("bk=a1");
  });

  it("truncates name beyond 40 chars and clamps moves to [0, 999], limit to [1, 999]", () => {
    const longName = "y".repeat(80);
    const url = shareUrlForEndgame({
      name: longName,
      wk: "a1",
      wr: "h1",
      bk: "e8",
      solved: true,
      moves: 5000,
      limit: 5000,
    });
    expect(url).toContain(`name=${"y".repeat(40)}&`);
    expect(url).not.toContain("y".repeat(41));
    expect(url).toContain("moves=999");
    expect(url).toContain("limit=999");

    const lowLimit = shareUrlForEndgame({
      name: "z",
      wk: "a1",
      wr: "h1",
      bk: "e8",
      solved: true,
      moves: -5,
      limit: -5,
    });
    expect(lowLimit).toContain("moves=0");
    expect(lowLimit).toContain("limit=1");
  });
});
