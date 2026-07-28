/**
 * SaveScore — canonical authorization payload (Slice 0).
 *
 * These tests pin the MESSAGE FORMAT and the server-side bounds. They are
 * deliberately signature-free: the format is a contract shared by the client
 * that builds it and the server that parses it, and it has to hold on its own
 * before any crypto is involved.
 *
 * Audit: docs/product/2026-07-27-score-and-leaders-audit.md §R1.
 */

import { describe, expect, it } from "vitest";

import {
  buildScoreSaveMessage,
  MAX_LEVEL_ID,
  MAX_SCORE_PER_LEVEL,
  MAX_SCORE_SAVE_TIME_MS,
  MAX_SCORE_SAVE_WINDOW_SECONDS,
  parseScoreSaveMessage,
  SCORE_SAVE_CLOCK_SKEW_SECONDS,
  validateScoreSaveClaim,
  type ScoreSaveClaim,
} from "../save-authorization";

const NOW_SECONDS = 1_800_000_000;
const PLAYER = "0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd";
const NONCE = "a1b2c3d4e5f60718293a4b5c6d7e8f90";

function claim(over: Partial<ScoreSaveClaim> = {}): ScoreSaveClaim {
  return {
    chainId: 42220,
    player: PLAYER,
    surface: "learn",
    levelId: 1,
    score: 1200,
    timeMs: 5000,
    issuedAt: NOW_SECONDS,
    expiresAt: NOW_SECONDS + 120,
    nonce: NONCE,
    ...over,
  };
}

const OPTS = {
  expectedSurface: "learn" as const,
  expectedChainId: 42220,
  nowSeconds: NOW_SECONDS,
};

describe("buildScoreSaveMessage / parseScoreSaveMessage", () => {
  it("round-trips a claim without losing a field", () => {
    const original = claim();
    expect(parseScoreSaveMessage(buildScoreSaveMessage(original))).toEqual(original);
  });

  it("names every security-relevant field in the text the wallet shows", () => {
    // The player reads this in the MiniPay prompt. A field missing here is a
    // field they are authorizing blind.
    const message = buildScoreSaveMessage(claim());
    for (const fragment of [
      "Chesscito Score Save v1",
      "chainId: 42220",
      `player: ${PLAYER}`,
      "surface: learn",
      "levelId: 1",
      "score: 1200",
      "timeMs: 5000",
      `nonce: ${NONCE}`,
    ]) {
      expect(message).toContain(fragment);
    }
  });

  it("lowercases the player so a checksummed address is not a second claim", () => {
    const checksummed = "0xCc4179a22B473ea2Eb2b9b9b210458D0F60Fc2Dd";
    const parsed = parseScoreSaveMessage(
      buildScoreSaveMessage(claim({ player: checksummed })),
    );
    expect(parsed?.player).toBe(PLAYER);
  });

  it("rejects a reordered message", () => {
    const lines = buildScoreSaveMessage(claim()).split("\n");
    [lines[2], lines[3]] = [lines[3], lines[2]];
    expect(parseScoreSaveMessage(lines.join("\n"))).toBeNull();
  });

  it("rejects a different version header", () => {
    const message = buildScoreSaveMessage(claim()).replace("v1", "v2");
    expect(parseScoreSaveMessage(message)).toBeNull();
  });

  it("rejects appended trailing content", () => {
    // Anchored regex: an attacker must not be able to smuggle extra lines
    // past a message the wallet already signed.
    const message = `${buildScoreSaveMessage(claim())}\nsurface: play`;
    expect(parseScoreSaveMessage(message)).toBeNull();
  });

  it.each([
    ["NaN", "score: NaN"],
    ["Infinity", "score: Infinity"],
    ["negative", "score: -5"],
    ["fractional", "score: 1.5"],
    ["exponential", "score: 1e9"],
    ["hex", "score: 0x10"],
  ])("rejects a %s score at the parse boundary", (_label, replacement) => {
    const message = buildScoreSaveMessage(claim()).replace("score: 1200", replacement);
    expect(parseScoreSaveMessage(message)).toBeNull();
  });

  it("rejects a non-string message", () => {
    expect(parseScoreSaveMessage(null)).toBeNull();
    expect(parseScoreSaveMessage({ score: 1 })).toBeNull();
  });

  it("rejects an unknown surface", () => {
    const message = buildScoreSaveMessage(claim()).replace(
      "surface: learn",
      "surface: admin",
    );
    expect(parseScoreSaveMessage(message)).toBeNull();
  });
});

describe("validateScoreSaveClaim", () => {
  it("accepts a well-formed claim", () => {
    expect(validateScoreSaveClaim(claim(), OPTS)).toEqual({ ok: true, claim: claim() });
  });

  // ── Surface: the whole point of R12 ──────────────────────────────────────
  it("accepts learn on a learn deployment", () => {
    const result = validateScoreSaveClaim(claim({ surface: "learn" }), {
      ...OPTS,
      expectedSurface: "learn",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects play on a learn deployment", () => {
    const result = validateScoreSaveClaim(claim({ surface: "play" }), {
      ...OPTS,
      expectedSurface: "learn",
    });
    expect(result).toEqual({ ok: false, error: "surface_mismatch" });
  });

  it("accepts play on a play deployment", () => {
    const result = validateScoreSaveClaim(claim({ surface: "play" }), {
      ...OPTS,
      expectedSurface: "play",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects learn on a play deployment", () => {
    const result = validateScoreSaveClaim(claim({ surface: "learn" }), {
      ...OPTS,
      expectedSurface: "play",
    });
    expect(result).toEqual({ ok: false, error: "surface_mismatch" });
  });

  // ── Chain ────────────────────────────────────────────────────────────────
  it("rejects a chain the deployment is not configured for", () => {
    const result = validateScoreSaveClaim(claim({ chainId: 1 }), OPTS);
    expect(result).toEqual({ ok: false, error: "invalid_chain" });
  });

  it("only shape-checks the chain when none is configured", () => {
    const result = validateScoreSaveClaim(claim({ chainId: 1 }), {
      ...OPTS,
      expectedChainId: null,
    });
    expect(result.ok).toBe(true);
  });

  // ── Bounds ───────────────────────────────────────────────────────────────
  it.each([0, 7, -1, 1.5, Number.NaN])("rejects levelId %s", (levelId) => {
    const result = validateScoreSaveClaim(claim({ levelId }), OPTS);
    expect(result).toEqual({ ok: false, error: "invalid_level" });
  });

  it("accepts the highest valid levelId", () => {
    expect(validateScoreSaveClaim(claim({ levelId: MAX_LEVEL_ID }), OPTS).ok).toBe(true);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects score %s",
    (score) => {
      const result = validateScoreSaveClaim(claim({ score }), OPTS);
      expect(result).toEqual({ ok: false, error: "invalid_score" });
    },
  );

  it("accepts a score exactly at the ceiling", () => {
    expect(
      validateScoreSaveClaim(claim({ score: MAX_SCORE_PER_LEVEL }), OPTS).ok,
    ).toBe(true);
  });

  it("rejects a score one point over the ceiling", () => {
    const result = validateScoreSaveClaim(claim({ score: MAX_SCORE_PER_LEVEL + 1 }), OPTS);
    expect(result).toEqual({ ok: false, error: "score_out_of_range" });
  });

  it("rejects the kind of score that used to reach the DB and overflow the view", () => {
    // Audit R13: `score` is a Postgres int and the aggregate summed six of
    // them into another int. This value is what made the whole view raise.
    const result = validateScoreSaveClaim(claim({ score: 2_147_483_647 }), OPTS);
    expect(result).toEqual({ ok: false, error: "score_out_of_range" });
  });

  it("keeps six maxed levels inside a signed 32-bit integer", () => {
    // The ceiling is not just per-row: six of them must still sum to something
    // the aggregate can hold even before the bigint widening.
    expect(MAX_SCORE_PER_LEVEL * MAX_LEVEL_ID).toBeLessThan(2_147_483_647);
  });

  it.each([0, -1, MAX_SCORE_SAVE_TIME_MS + 1, Number.NaN])(
    "rejects timeMs %s",
    (timeMs) => {
      const result = validateScoreSaveClaim(claim({ timeMs }), OPTS);
      expect(result).toEqual({ ok: false, error: "invalid_time" });
    },
  );

  // ── Validity window ──────────────────────────────────────────────────────
  it("rejects an expired claim", () => {
    const result = validateScoreSaveClaim(claim(), {
      ...OPTS,
      nowSeconds: NOW_SECONDS + 120 + SCORE_SAVE_CLOCK_SKEW_SECONDS + 1,
    });
    expect(result).toEqual({ ok: false, error: "expired" });
  });

  it("tolerates a device clock inside the skew allowance", () => {
    const result = validateScoreSaveClaim(claim(), {
      ...OPTS,
      nowSeconds: NOW_SECONDS + 120 + SCORE_SAVE_CLOCK_SKEW_SECONDS - 1,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a claim issued too far in the future", () => {
    const result = validateScoreSaveClaim(
      claim({
        issuedAt: NOW_SECONDS + SCORE_SAVE_CLOCK_SKEW_SECONDS + 60,
        expiresAt: NOW_SECONDS + SCORE_SAVE_CLOCK_SKEW_SECONDS + 120,
      }),
      OPTS,
    );
    expect(result).toEqual({ ok: false, error: "not_yet_valid" });
  });

  it("refuses a self-issued long-lived bearer token", () => {
    // A client must not be able to mint itself a week-long authorization by
    // simply widening its own window.
    const result = validateScoreSaveClaim(
      claim({ expiresAt: NOW_SECONDS + MAX_SCORE_SAVE_WINDOW_SECONDS + 1 }),
      OPTS,
    );
    expect(result).toEqual({ ok: false, error: "invalid_window" });
  });

  it("rejects an inverted window", () => {
    const result = validateScoreSaveClaim(
      claim({ issuedAt: NOW_SECONDS, expiresAt: NOW_SECONDS - 10 }),
      OPTS,
    );
    expect(result).toEqual({ ok: false, error: "invalid_window" });
  });

  it("rejects a malformed nonce", () => {
    const result = validateScoreSaveClaim(claim({ nonce: "short" }), OPTS);
    expect(result).toEqual({ ok: false, error: "invalid_message" });
  });
});
