import { describe, expect, it } from "vitest";

import { deriveFeaturedCardState } from "@/lib/minigames/card-state";
import { baselineMiniGamePools } from "@/lib/minigames/pools";
import { resolveChallengePool } from "@/lib/minigames/queue";

const pools = baselineMiniGamePools();

/** `rook-rail-two-roads` is level 4 of the rook lane; its engine siblings are
 *  the other three rook-rail levels. Any surface may offer a mid-lane level, so
 *  IN_PROGRESS has to be reachable. */
const featured = resolveChallengePool(pools).find(
  (entry) => entry.challengeId === "rook-rail-two-roads",
)!;

function state(bests: Record<string, Record<string, number>>) {
  return deriveFeaturedCardState({ featured, pools, bestsByPiece: bests });
}

describe("deriveFeaturedCardState — Early Access has no locked state", () => {
  it("is AVAILABLE when the player has touched nothing in this engine", () => {
    expect(state({})).toBe("FEATURED_AVAILABLE");
  });

  /** AC-6. A recorded best is the only completion signal, and it survives
   *  any change to what is on screen (AC-11). */
  it("is COMPLETED when the featured challenge itself has a recorded best", () => {
    expect(state({ rook: { "rook-rail-two-roads": 6 } })).toBe("FEATURED_COMPLETED");
  });

  /** The only way IN_PROGRESS is reachable at per-challenge granularity: the
   *  featured level is unplayed but the player has finished a sibling of the
   *  same engine, so "Continue" is the honest verb. */
  it("is IN_PROGRESS when a sibling of the same engine is done but this one is not", () => {
    expect(state({ rook: { "rook-rail-two-turns": 4 } })).toBe(
      "FEATURED_IN_PROGRESS",
    );
  });

  it("ignores progress recorded under a different engine", () => {
    expect(state({ bishop: { "bishop-run-1": 5 } })).toBe("FEATURED_AVAILABLE");
  });

  it("ignores a retired sibling id — retired content never implies progress", () => {
    expect(state({ rook: { "rook-lab-1": 4 } })).toBe("FEATURED_AVAILABLE");
  });

  /** ⛔ AC-5 as a type-level guarantee: the union must not be able to express a
   *  paid or progression-locked card while Early Access is the policy. */
  it("can never return a locked or purchasable state", () => {
    const reachable = [
      state({}),
      state({ rook: { "rook-rail-two-roads": 6 } }),
      state({ rook: { "rook-rail-two-turns": 4 } }),
    ];
    for (const value of reachable) {
      expect(value).not.toBe("PROGRESSION_LOCKED");
      expect(value).not.toBe("EARLY_UNLOCK_AVAILABLE");
      expect(value.startsWith("FEATURED_")).toBe(true);
    }
  });
});
