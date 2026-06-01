import { describe, it, expect } from "vitest";

import { selectRescueModalState } from "../use-rescue-modal-state";

describe("selectRescueModalState", () => {
  it("returns variant A when shields >= 1 and seenCount == 0 (first-encounter primer)", () => {
    const result = selectRescueModalState({
      shieldsCount: 3,
      welcomePackClaimed: false,
      rescueSeenCount: 0,
    });
    expect(result).toEqual({ variant: "A", hasShields: true });
  });

  it("returns variant B when shields >= 1 and seenCount >= 1 (no primer)", () => {
    const result = selectRescueModalState({
      shieldsCount: 3,
      welcomePackClaimed: false,
      rescueSeenCount: 1,
    });
    expect(result).toEqual({ variant: "B", hasShields: true });
  });

  it("returns variant A on the first shield-available encounter EVEN IF user previously saw without-shields variants", () => {
    // User saw C/D first (without shields), got shields, now fails
    // again. They've never seen the shield mechanic explained at
    // the rescue moment → primer is appropriate.
    const result = selectRescueModalState({
      shieldsCount: 1,
      welcomePackClaimed: true,
      rescueSeenCount: 0,
    });
    expect(result.variant).toBe("A");
  });

  it("returns variant C when shields == 0, welcome pack NOT claimed, ignoreCount < 3", () => {
    const result = selectRescueModalState({
      shieldsCount: 0,
      welcomePackClaimed: false,
      rescueSeenCount: 0,
    });
    expect(result).toEqual({ variant: "C", hasShields: false });
  });

  it("returns variant D when shields == 0 AND welcome pack already claimed (no pitch left)", () => {
    const result = selectRescueModalState({
      shieldsCount: 0,
      welcomePackClaimed: true,
      rescueSeenCount: 0,
    });
    expect(result).toEqual({ variant: "D", hasShields: false });
  });

  it("ALWAYS returns variant C while welcome pack is unclaimed, regardless of seenCount (no nag graduation)", () => {
    // Earlier iteration used seenCount >= 3 as a graduation threshold
    // from C → D. That trapped players on the paid upsell after just
    // 3 failures even though the free welcome pack was still
    // available. Reverted 2026-05-31 per user feedback.
    for (const seen of [0, 1, 2, 3, 5, 10]) {
      const result = selectRescueModalState({
        shieldsCount: 0,
        welcomePackClaimed: false,
        rescueSeenCount: seen,
      });
      expect(result.variant).toBe("C");
    }
  });

  it("hasShields flag matches the variant family (A/B = true, C/D = false)", () => {
    expect(
      selectRescueModalState({
        shieldsCount: 5,
        welcomePackClaimed: false,
        rescueSeenCount: 0,
      }).hasShields,
    ).toBe(true);
    expect(
      selectRescueModalState({
        shieldsCount: 5,
        welcomePackClaimed: true,
        rescueSeenCount: 5,
      }).hasShields,
    ).toBe(true);
    expect(
      selectRescueModalState({
        shieldsCount: 0,
        welcomePackClaimed: false,
        rescueSeenCount: 0,
      }).hasShields,
    ).toBe(false);
    expect(
      selectRescueModalState({
        shieldsCount: 0,
        welcomePackClaimed: true,
        rescueSeenCount: 0,
      }).hasShields,
    ).toBe(false);
  });

  it("is pure / referentially transparent — same inputs → same output", () => {
    const input = {
      shieldsCount: 2,
      welcomePackClaimed: false,
      rescueSeenCount: 1,
    };
    expect(selectRescueModalState(input)).toEqual(
      selectRescueModalState(input),
    );
  });
});
