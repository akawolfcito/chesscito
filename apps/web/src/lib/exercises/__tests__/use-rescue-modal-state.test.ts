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

  it("returns variant D when shields == 0 AND seenCount >= 3 (graduates from welcome pitch to paid SKU)", () => {
    const result = selectRescueModalState({
      shieldsCount: 0,
      welcomePackClaimed: false,
      rescueSeenCount: 3,
    });
    expect(result).toEqual({ variant: "D", hasShields: false });
  });

  it("returns variant C at the boundary (seenCount == 2, just under graduation threshold)", () => {
    const result = selectRescueModalState({
      shieldsCount: 0,
      welcomePackClaimed: false,
      rescueSeenCount: 2,
    });
    expect(result.variant).toBe("C");
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
