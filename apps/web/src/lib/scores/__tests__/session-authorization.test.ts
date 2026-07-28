/**
 * Score write sessions — canonical challenge payload (Slice 0.1).
 *
 * Pins the MESSAGE FORMAT and the server policy bounds. Signature-free on
 * purpose: the format is a contract shared by the client that renders it and
 * the server that parses it, and it has to hold before any crypto is involved.
 *
 * Audit: docs/product/2026-07-27-score-and-leaders-audit.md §10.
 */

import { describe, expect, it } from "vitest";

import {
  buildScoreSessionMessage,
  parseScoreSessionMessage,
  SCORE_SESSION_CLOCK_SKEW_SECONDS,
  SCORE_SESSION_MAX_SAVES,
  SCORE_SESSION_TTL_SECONDS,
  validateScoreSessionChallenge,
  type ScoreSessionChallenge,
} from "../session-authorization";

const NOW = 1_800_000_000;
const WALLET = "0xcc4179a22b473ea2eb2b9b9b210458d0f60fc2dd";
const SESSION_ID = "a1b2c3d4e5f60718293a4b5c6d7e8f90";

function challenge(over: Partial<ScoreSessionChallenge> = {}): ScoreSessionChallenge {
  return {
    chainId: 42220,
    wallet: WALLET,
    surface: "learn",
    sessionId: SESSION_ID,
    issuedAt: NOW,
    expiresAt: NOW + SCORE_SESSION_TTL_SECONDS,
    maxSaves: SCORE_SESSION_MAX_SAVES,
    ...over,
  };
}

const OPTS = {
  expectedSurface: "learn" as const,
  expectedChainId: 42220,
  nowSeconds: NOW,
};

describe("build / parse", () => {
  it("round-trips without losing a field", () => {
    const c = challenge();
    expect(parseScoreSessionMessage(buildScoreSessionMessage(c))).toEqual(c);
  });

  it("names every term the player is agreeing to", () => {
    // The prompt is the consent UI. A term missing here is a capability
    // granted blind.
    const message = buildScoreSessionMessage(challenge());
    for (const fragment of [
      "Chesscito Score Session v1",
      "chainId: 42220",
      `wallet: ${WALLET}`,
      "surface: learn",
      `sessionId: ${SESSION_ID}`,
      `maxSaves: ${SCORE_SESSION_MAX_SAVES}`,
    ]) {
      expect(message).toContain(fragment);
    }
  });

  it("lowercases the wallet so a checksummed address is not a second claim", () => {
    const parsed = parseScoreSessionMessage(
      buildScoreSessionMessage(
        challenge({ wallet: "0xCc4179a22B473ea2Eb2b9b9b210458D0F60Fc2Dd" }),
      ),
    );
    expect(parsed?.wallet).toBe(WALLET);
  });

  it("rejects a reordered message", () => {
    const lines = buildScoreSessionMessage(challenge()).split("\n");
    [lines[2], lines[3]] = [lines[3], lines[2]];
    expect(parseScoreSessionMessage(lines.join("\n"))).toBeNull();
  });

  it("rejects a different version header", () => {
    expect(
      parseScoreSessionMessage(buildScoreSessionMessage(challenge()).replace("v1", "v2")),
    ).toBeNull();
  });

  it("rejects appended trailing content", () => {
    const message = `${buildScoreSessionMessage(challenge())}\nmaxSaves: 9999`;
    expect(parseScoreSessionMessage(message)).toBeNull();
  });

  it.each([
    ["NaN", "maxSaves: NaN"],
    ["negative", "maxSaves: -5"],
    ["fractional", "maxSaves: 2.5"],
    ["exponential", "maxSaves: 1e9"],
  ])("rejects a %s maxSaves at the parse boundary", (_label, replacement) => {
    const message = buildScoreSessionMessage(challenge()).replace(
      `maxSaves: ${SCORE_SESSION_MAX_SAVES}`,
      replacement,
    );
    expect(parseScoreSessionMessage(message)).toBeNull();
  });

  it("rejects an unknown surface", () => {
    const message = buildScoreSessionMessage(challenge()).replace(
      "surface: learn",
      "surface: admin",
    );
    expect(parseScoreSessionMessage(message)).toBeNull();
  });

  it("rejects a non-string message", () => {
    expect(parseScoreSessionMessage(null)).toBeNull();
    expect(parseScoreSessionMessage({ maxSaves: 1 })).toBeNull();
  });
});

describe("validateScoreSessionChallenge", () => {
  it("accepts well-formed terms", () => {
    expect(validateScoreSessionChallenge(challenge(), OPTS).ok).toBe(true);
  });

  // ── surface vs deployment ────────────────────────────────────────────────
  it.each([
    ["learn", "learn", true],
    ["learn", "play", false],
    ["play", "play", true],
    ["play", "learn", false],
  ] as const)(
    "deployment %s with challenge surface %s → ok=%s",
    (expectedSurface, surface, ok) => {
      const result = validateScoreSessionChallenge(challenge({ surface }), {
        ...OPTS,
        expectedSurface,
      });
      expect(result.ok).toBe(ok);
      if (!ok && !result.ok) expect(result.error).toBe("surface_mismatch");
    },
  );

  // ── chain ────────────────────────────────────────────────────────────────
  it("rejects a chain the deployment is not configured for", () => {
    expect(validateScoreSessionChallenge(challenge({ chainId: 1 }), OPTS)).toEqual({
      ok: false,
      error: "invalid_chain",
    });
  });

  it("only shape-checks the chain when none is configured", () => {
    expect(
      validateScoreSessionChallenge(challenge({ chainId: 1 }), {
        ...OPTS,
        expectedChainId: null,
      }).ok,
    ).toBe(true);
  });

  // ── window ───────────────────────────────────────────────────────────────
  it("rejects an expired challenge", () => {
    const result = validateScoreSessionChallenge(challenge(), {
      ...OPTS,
      nowSeconds: NOW + SCORE_SESSION_TTL_SECONDS + SCORE_SESSION_CLOCK_SKEW_SECONDS + 1,
    });
    expect(result).toEqual({ ok: false, error: "expired" });
  });

  it("tolerates a device clock inside the skew allowance", () => {
    const result = validateScoreSessionChallenge(challenge(), {
      ...OPTS,
      nowSeconds: NOW + SCORE_SESSION_TTL_SECONDS + SCORE_SESSION_CLOCK_SKEW_SECONDS - 1,
    });
    expect(result.ok).toBe(true);
  });

  it("refuses a window wider than server policy", () => {
    // A client that fabricates its own message must not be able to grant
    // itself a week-long capability.
    const result = validateScoreSessionChallenge(
      challenge({ expiresAt: NOW + SCORE_SESSION_TTL_SECONDS + 1 }),
      OPTS,
    );
    expect(result).toEqual({ ok: false, error: "invalid_window" });
  });

  it("rejects an inverted window", () => {
    expect(
      validateScoreSessionChallenge(challenge({ expiresAt: NOW - 10 }), OPTS),
    ).toEqual({ ok: false, error: "invalid_window" });
  });

  // ── budget ───────────────────────────────────────────────────────────────
  it("refuses a self-granted save budget above policy", () => {
    const result = validateScoreSessionChallenge(
      challenge({ maxSaves: SCORE_SESSION_MAX_SAVES + 1 }),
      OPTS,
    );
    expect(result).toEqual({ ok: false, error: "invalid_max_saves" });
  });

  it("rejects a zero budget", () => {
    expect(validateScoreSessionChallenge(challenge({ maxSaves: 0 }), OPTS)).toEqual({
      ok: false,
      error: "invalid_max_saves",
    });
  });

  it("rejects a malformed sessionId", () => {
    expect(validateScoreSessionChallenge(challenge({ sessionId: "short" }), OPTS)).toEqual({
      ok: false,
      error: "invalid_message",
    });
  });
});

describe("policy constants", () => {
  it("budgets more saves than a maxed-out day can produce", () => {
    // HARD_MAX_EXTRAS is 15 (10 free + 2 packs x 5). Saves fire per
    // improvement, not per exercise, so the budget needs headroom above that
    // or a dedicated player gets re-prompted mid-session.
    expect(SCORE_SESSION_MAX_SAVES).toBeGreaterThan(15);
  });

  it("lasts long enough to cover a play session but not a day", () => {
    expect(SCORE_SESSION_TTL_SECONDS).toBe(2 * 60 * 60);
    expect(SCORE_SESSION_TTL_SECONDS).toBeLessThan(24 * 60 * 60);
  });
});
