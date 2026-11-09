/**
 * SaveScore — surface identity and the server-side bounds on a written score.
 *
 * These bounds run on EVERY save regardless of how the caller authenticated.
 * A valid session token authorizes *writing*; it does not authorize *any
 * value*. That distinction is what keeps a leaked token bounded to a nuisance
 * instead of a way to mint an arbitrary leaderboard total.
 *
 * Audit: docs/product/2026-07-27-score-and-leaders-audit.md §R1, §R13.
 */

import { describe, expect, it } from "vitest";

import {
  isScoreSaveSurface,
  MAX_LEVEL_ID,
  MAX_SCORE_PER_LEVEL,
  MAX_SCORE_SAVE_TIME_MS,
  MIN_LEVEL_ID,
  validateScoreSaveBounds,
} from "../save-authorization";

const VALID = { levelId: 1, score: 1200, timeMs: 5000 };

describe("isScoreSaveSurface", () => {
  it("accepts the two shipped surfaces", () => {
    expect(isScoreSaveSurface("learn")).toBe(true);
    expect(isScoreSaveSurface("play")).toBe(true);
  });

  it("rejects anything else, including full (internal, never a written value)", () => {
    for (const v of ["full", "admin", "", null, 1, undefined]) {
      expect(isScoreSaveSurface(v)).toBe(false);
    }
  });
});

describe("validateScoreSaveBounds", () => {
  it("accepts a well-formed save", () => {
    expect(validateScoreSaveBounds(VALID)).toEqual({ ok: true, value: VALID });
  });

  // ── levelId ──────────────────────────────────────────────────────────────
  it.each([0, 7, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects levelId %s",
    (levelId) => {
      expect(validateScoreSaveBounds({ ...VALID, levelId })).toEqual({
        ok: false,
        error: "invalid_level",
      });
    },
  );

  it.each([MIN_LEVEL_ID, MAX_LEVEL_ID])("accepts boundary levelId %i", (levelId) => {
    expect(validateScoreSaveBounds({ ...VALID, levelId }).ok).toBe(true);
  });

  it("rejects a non-numeric levelId", () => {
    expect(validateScoreSaveBounds({ ...VALID, levelId: "1" })).toEqual({
      ok: false,
      error: "invalid_level",
    });
  });

  // ── score ────────────────────────────────────────────────────────────────
  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects score %s",
    (score) => {
      expect(validateScoreSaveBounds({ ...VALID, score })).toEqual({
        ok: false,
        error: "invalid_score",
      });
    },
  );

  it("accepts a score exactly at the ceiling", () => {
    expect(validateScoreSaveBounds({ ...VALID, score: MAX_SCORE_PER_LEVEL }).ok).toBe(true);
  });

  it("rejects a score one point over the ceiling", () => {
    expect(validateScoreSaveBounds({ ...VALID, score: MAX_SCORE_PER_LEVEL + 1 })).toEqual({
      ok: false,
      error: "score_out_of_range",
    });
  });

  it("rejects the kind of score that used to reach the DB and overflow the view", () => {
    // Audit R13: `score` is a Postgres int and the aggregate summed six of
    // them into another int. This value is what made the whole view raise.
    expect(validateScoreSaveBounds({ ...VALID, score: 2_147_483_647 })).toEqual({
      ok: false,
      error: "score_out_of_range",
    });
  });

  it("keeps six maxed levels inside a signed 32-bit integer", () => {
    // The ceiling is not just per-row: six of them must still sum to something
    // an int4 aggregate could hold, even though the view is bigint now.
    expect(MAX_SCORE_PER_LEVEL * MAX_LEVEL_ID).toBeLessThan(2_147_483_647);
  });

  // ── timeMs ───────────────────────────────────────────────────────────────
  it.each([0, -1, MAX_SCORE_SAVE_TIME_MS + 1, Number.NaN])(
    "rejects timeMs %s",
    (timeMs) => {
      expect(validateScoreSaveBounds({ ...VALID, timeMs })).toEqual({
        ok: false,
        error: "invalid_time",
      });
    },
  );

  it("accepts timeMs at the one-hour ceiling", () => {
    expect(
      validateScoreSaveBounds({ ...VALID, timeMs: MAX_SCORE_SAVE_TIME_MS }).ok,
    ).toBe(true);
  });
});
