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
