import { describe, it, expect } from "vitest";

import { selectRescueModalState } from "../use-rescue-modal-state";

describe("selectRescueModalState", () => {
  it("returns variant A when shields >= 1 and primer has NOT been shown", () => {
    const result = selectRescueModalState({
      shieldsCount: 3,
      welcomePackClaimed: false,
      rescuePrimerShown: false,
    });
    expect(result).toEqual({ variant: "A", hasShields: true });
  });

  it("returns variant B when shields >= 1 and primer has been shown", () => {
    const result = selectRescueModalState({
      shieldsCount: 3,
      welcomePackClaimed: false,
      rescuePrimerShown: true,
    });
    expect(result).toEqual({ variant: "B", hasShields: true });
  });

  it("returns variant A even after claiming the Welcome Pack — primer fires on FIRST shield-available rescue (E18 fix)", () => {
    // Scenario: player's first failure was variant C (without
    // shields). seenCount-based selector would have bumped a counter
    // and skipped A on the next-failure-with-shields. The primer flag
    // is independent of that counter, so A correctly fires.
    const result = selectRescueModalState({
      shieldsCount: 3,
      welcomePackClaimed: true,
      rescuePrimerShown: false,
    });
    expect(result.variant).toBe("A");
  });

  it("returns variant C when shields == 0 and welcome pack NOT claimed", () => {
    const result = selectRescueModalState({
      shieldsCount: 0,
      welcomePackClaimed: false,
      rescuePrimerShown: false,
    });
    expect(result).toEqual({ variant: "C", hasShields: false });
  });

  it("returns variant D when shields == 0 AND welcome pack already claimed (no pitch left)", () => {
    const result = selectRescueModalState({
      shieldsCount: 0,
      welcomePackClaimed: true,
      rescuePrimerShown: false,
    });
    expect(result).toEqual({ variant: "D", hasShields: false });
  });

  it("variant C is independent of primer flag — without shields the primer state is irrelevant", () => {
    for (const primer of [false, true]) {
      const result = selectRescueModalState({
        shieldsCount: 0,
        welcomePackClaimed: false,
        rescuePrimerShown: primer,
      });
      expect(result.variant).toBe("C");
    }
  });

  it("hasShields flag matches the variant family (A/B = true, C/D = false)", () => {
    expect(
      selectRescueModalState({
        shieldsCount: 5,
        welcomePackClaimed: false,
        rescuePrimerShown: false,
      }).hasShields,
    ).toBe(true);
    expect(
      selectRescueModalState({
        shieldsCount: 5,
        welcomePackClaimed: true,
        rescuePrimerShown: true,
      }).hasShields,
    ).toBe(true);
    expect(
      selectRescueModalState({
        shieldsCount: 0,
        welcomePackClaimed: false,
        rescuePrimerShown: false,
      }).hasShields,
    ).toBe(false);
    expect(
      selectRescueModalState({
        shieldsCount: 0,
        welcomePackClaimed: true,
        rescuePrimerShown: false,
      }).hasShields,
    ).toBe(false);
  });

  it("is pure / referentially transparent — same inputs → same output", () => {
    const input = {
      shieldsCount: 2,
      welcomePackClaimed: false,
      rescuePrimerShown: true,
    };
    expect(selectRescueModalState(input)).toEqual(
      selectRescueModalState(input),
    );
  });
});
