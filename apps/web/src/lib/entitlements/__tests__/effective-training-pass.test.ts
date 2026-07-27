import { describe, expect, it } from "vitest";

import { resolveEffectiveTrainingPass } from "../effective-training-pass";

const NOW = Date.parse("2026-07-05T12:00:00.000Z");
const FUTURE_ISO = "2026-07-20T12:00:00.000Z";
const PAST_ISO = "2026-07-01T12:00:00.000Z";
const FUTURE_MS = NOW + 7 * 86_400_000;
const PAST_MS = NOW - 1;

describe("resolveEffectiveTrainingPass", () => {
  it("returns inactive when neither entitlement exists", () => {
    expect(
      resolveEffectiveTrainingPass({
        seasonPass: { active: false, expiresAt: null },
        pro: { active: false, expiresAt: null },
        now: NOW,
      }),
    ).toEqual({
      active: false,
      source: null,
      seasonPassExpiresAt: null,
      proExpiresAt: null,
      seasonId: null,
    });
  });

  it("uses an active direct Season Pass", () => {
    expect(
      resolveEffectiveTrainingPass({
        seasonPass: { active: true, expiresAt: FUTURE_ISO },
        pro: { active: false, expiresAt: null },
        now: NOW,
      }),
    ).toMatchObject({ active: true, source: "season_pass" });
  });

  it("uses active PRO as Training Pass coverage", () => {
    expect(
      resolveEffectiveTrainingPass({
        seasonPass: { active: false, expiresAt: null },
        pro: { active: true, expiresAt: FUTURE_MS },
        now: NOW,
      }),
    ).toEqual({
      active: true,
      source: "pro",
      seasonPassExpiresAt: null,
      proExpiresAt: FUTURE_MS,
      seasonId: null,
    });
  });

  it("prefers PRO as the public source when both are active", () => {
    expect(
      resolveEffectiveTrainingPass({
        seasonPass: { active: true, expiresAt: FUTURE_ISO },
        pro: { active: true, expiresAt: FUTURE_MS },
        now: NOW,
      }),
    ).toEqual({
      active: true,
      source: "pro",
      seasonPassExpiresAt: FUTURE_ISO,
      proExpiresAt: FUTURE_MS,
      seasonId: null,
    });
  });

  it("does not count expired entitlements even when their active flag is stale", () => {
    expect(
      resolveEffectiveTrainingPass({
        seasonPass: { active: true, expiresAt: PAST_ISO },
        pro: { active: true, expiresAt: PAST_MS },
        now: NOW,
      }),
    ).toMatchObject({ active: false, source: null });
  });
});

/** Spec: docs/specs/2026-07-27-focus-days-ledger.md (APPROVED) — the seasonId
 *  is resolved HERE, once, and never per-branch inside the status route. */
describe("resolveEffectiveTrainingPass — canonical seasonId", () => {
  it("carries the purchased season, not the configured one (AC30)", () => {
    expect(
      resolveEffectiveTrainingPass({
        seasonPass: { active: true, expiresAt: FUTURE_ISO, seasonId: "bought-in-q3" },
        pro: { active: false, expiresAt: null },
        configuredSeasonId: "rolled-over-to-q4",
        now: NOW,
      }).seasonId,
    ).toBe("bought-in-q3");
  });

  it("refuses to substitute the configured season when the purchased one is unknown", () => {
    // The Redis fast path knows the expiry but not the row. Inventing a season
    // here is how a buyer's progress lands under someone else's temporada.
    expect(
      resolveEffectiveTrainingPass({
        seasonPass: { active: true, expiresAt: FUTURE_ISO, seasonId: null },
        pro: { active: false, expiresAt: null },
        configuredSeasonId: "rolled-over-to-q4",
        now: NOW,
      }).seasonId,
    ).toBeNull();
  });

  it("uses the configured season for PRO, which has no purchased row", () => {
    expect(
      resolveEffectiveTrainingPass({
        seasonPass: { active: false, expiresAt: null },
        pro: { active: true, expiresAt: FUTURE_MS },
        configuredSeasonId: "21day-mind-challenge-2026-q3",
        now: NOW,
      }).seasonId,
    ).toBe("21day-mind-challenge-2026-q3");
  });

  it("has no season at all without an entitlement", () => {
    expect(
      resolveEffectiveTrainingPass({
        seasonPass: { active: false, expiresAt: null },
        pro: { active: false, expiresAt: null },
        configuredSeasonId: "21day-mind-challenge-2026-q3",
        now: NOW,
      }).seasonId,
    ).toBeNull();
  });
});
