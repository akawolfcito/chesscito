import { afterEach, describe, expect, it, vi } from "vitest";

import {
  assignOnboardingVariant,
  bucketForInstall,
  decideFirstActivity,
  onboardingFirstActivityRolloutPct,
  type FirstActivityContext,
} from "../first-activity-experiment";

const ORIGINAL = process.env.NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT;

afterEach(() => {
  process.env.NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT = ORIGINAL;
  vi.unstubAllEnvs();
});

describe("rollout percentage", () => {
  it("defaults to 0 — the experiment ships dark", () => {
    delete process.env.NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT;
    expect(onboardingFirstActivityRolloutPct()).toBe(0);
  });

  it("reads a valid percentage", () => {
    process.env.NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT = "25";
    expect(onboardingFirstActivityRolloutPct()).toBe(25);
  });

  /** A typo must never roll an experiment out to everyone. Every unparseable
   *  or out-of-range value fails CLOSED, which is the opposite of
   *  `isAttemptLaneEnabled`'s deliberate fail-open. */
  it.each(["abc", "", "-5", "101", "1e999", "NaN"])(
    "treats %j as 0 rather than guessing",
    (raw) => {
      process.env.NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT = raw;
      expect(onboardingFirstActivityRolloutPct()).toBe(0);
    },
  );

  it("floors a fractional percentage instead of rejecting it", () => {
    process.env.NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT = "12.7";
    expect(onboardingFirstActivityRolloutPct()).toBe(12);
  });
});

describe("bucketForInstall", () => {
  it("is deterministic — the same install always lands in the same bucket", () => {
    const a = bucketForInstall("a1b2c3d4e5f60718");
    for (let i = 0; i < 20; i += 1) {
      expect(bucketForInstall("a1b2c3d4e5f60718")).toBe(a);
    }
  });

  it("always lands inside [0, 100)", () => {
    for (let i = 0; i < 500; i += 1) {
      const b = bucketForInstall(`install-${i}`);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(100);
    }
  });

  /** A hash that clumps would make a 50% rollout land on 5% of installs and
   *  the experiment would read as underpowered rather than as broken. */
  it("spreads roughly evenly across the range", () => {
    const counts = new Array(10).fill(0);
    for (let i = 0; i < 2000; i += 1) {
      counts[Math.floor(bucketForInstall(`chesscito-install-${i}`) / 10)]! += 1;
    }
    for (const c of counts) {
      expect(c).toBeGreaterThan(100); // expected 200 per decile
      expect(c).toBeLessThan(320);
    }
  });
});

describe("assignOnboardingVariant", () => {
  it("returns null without an install id — unattributable is not control", () => {
    expect(assignOnboardingVariant("", 100)).toBeNull();
  });

  it("puts everyone in control at 0% (the kill switch)", () => {
    for (let i = 0; i < 50; i += 1) {
      expect(assignOnboardingVariant(`install-${i}`, 0)).toBe("control");
    }
  });

  it("puts everyone in the variant at 100%", () => {
    for (let i = 0; i < 50; i += 1) {
      expect(assignOnboardingVariant(`install-${i}`, 100)).toBe(
        "first-activity",
      );
    }
  });

  it("splits roughly at the requested percentage", () => {
    let variant = 0;
    const N = 2000;
    for (let i = 0; i < N; i += 1) {
      if (assignOnboardingVariant(`chesscito-install-${i}`, 20) === "first-activity") {
        variant += 1;
      }
    }
    expect(variant / N).toBeGreaterThan(0.15);
    expect(variant / N).toBeLessThan(0.25);
  });

  /** The property the whole experiment rests on: refresh, reentry and
   *  back-navigation must not move anyone. Assignment is pure, so this holds
   *  without any persisted state. */
  it("never moves an install between groups", () => {
    const id = "stable-install-id";
    const first = assignOnboardingVariant(id, 50);
    for (let i = 0; i < 100; i += 1) {
      expect(assignOnboardingVariant(id, 50)).toBe(first);
    }
  });
});

function ctx(over: Partial<FirstActivityContext> = {}): FirstActivityContext {
  return {
    installId: "eligible-install",
    isLearnSurface: true,
    isReplay: false,
    dailyAlreadyDone: false,
    rolloutPct: 100,
    ...over,
  };
}

describe("decideFirstActivity", () => {
  it("starts the activity for an eligible LEARN install in the variant arm", () => {
    expect(decideFirstActivity(ctx())).toEqual({
      start: true,
      variant: "first-activity",
    });
  });

  /** PLAY keeps exactly its current flow, and is not even assigned — an
   *  install that could never receive the treatment must not sit in the
   *  experiment's denominator. */
  it("never touches PLAY, and does not assign it a variant", () => {
    expect(decideFirstActivity(ctx({ isLearnSurface: false }))).toEqual({
      start: false,
      variant: null,
      reason: "not-learn",
    });
  });

  /** A veteran replaying the tour from settings is already using the product.
   *  Hijacking their hub would be a regression, not an experiment. */
  it("never hijacks a manual tour replay", () => {
    expect(decideFirstActivity(ctx({ isReplay: true }))).toEqual({
      start: false,
      variant: null,
      reason: "replay",
    });
  });

  it("stays out of the experiment when the install is unattributable", () => {
    expect(decideFirstActivity(ctx({ installId: "" }))).toEqual({
      start: false,
      variant: null,
      reason: "unassigned",
    });
  });

  /** Opening a finished Daily shows the "come back tomorrow" state — a closed
   *  door, not a first activity. The install STAYS assigned, because it really
   *  is in the experiment and dropping it would flatter the control arm. */
  it("does not open a Daily that is already done, but keeps the assignment", () => {
    expect(decideFirstActivity(ctx({ dailyAlreadyDone: true }))).toEqual({
      start: false,
      variant: "first-activity",
      reason: "daily-already-done",
    });
  });

  it("assigns control without starting anything", () => {
    expect(decideFirstActivity(ctx({ rolloutPct: 0 }))).toEqual({
      start: false,
      variant: "control",
      reason: "control-arm",
    });
  });

  /** Idempotence at the decision layer: calling it repeatedly for the same
   *  install yields the same answer, so a re-render cannot produce a second
   *  auto-open. */
  it("is idempotent for a given install", () => {
    const c = ctx({ rolloutPct: 50 });
    const first = decideFirstActivity(c);
    for (let i = 0; i < 25; i += 1) {
      expect(decideFirstActivity(c)).toEqual(first);
    }
  });
});
