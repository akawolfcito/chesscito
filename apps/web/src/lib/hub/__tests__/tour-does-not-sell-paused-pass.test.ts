/**
 * The mini-tour must not sell a product whose sale is paused.
 *
 * ⛔ THE LEAK. Pausing Season Pass sales hid the card's purchase banner, but the
 * onboarding tour kept its own step: "Join the 21-Day Challenge · $0.99 ·
 * one-time payment", shown to every new player on step 2 of 3. The pause was
 * applied to the surface and not to the funnel that pointed at it
 * (founder, 2026-08-26).
 *
 * That step exists to sell. With no sale there is nothing for it to say — the
 * daily step already explains the streak, and the panel it targets is now the
 * habit panel, which needs no pitch.
 */
import { describe, expect, it } from "vitest";

import { buildLearnHubTourSteps } from "../hub-tour";

const base = { dailyDone: false, streak: 0, includeDaily: true };

describe("learn hub tour — paused sales", () => {
  it("⛔ drops the purchase step when sales are paused", () => {
    const steps = buildLearnHubTourSteps({
      ...base,
      hasSeasonPass: false,
      salesPaused: true,
    });

    expect(steps.map((s) => s.id)).not.toContain("challenge");
    expect(steps.map((s) => s.bodyKey)).not.toContain("challengeJoin");
  });

  it("keeps the rest of the tour intact", () => {
    const steps = buildLearnHubTourSteps({
      ...base,
      hasSeasonPass: false,
      salesPaused: true,
    });

    expect(steps.map((s) => s.id)).toEqual(["daily", "rook"]);
  });

  it("STILL shows the step to someone who already owns the pass", () => {
    // They bought it; the tour explaining what they own is not a sale.
    const steps = buildLearnHubTourSteps({
      ...base,
      hasSeasonPass: true,
      salesPaused: true,
    });

    expect(steps.map((s) => s.bodyKey)).toContain("challengeEnrolled");
  });

  it("sells again the moment sales are re-enabled", () => {
    // The pause has to stay reversible in the funnel too, not just the card.
    const steps = buildLearnHubTourSteps({
      ...base,
      hasSeasonPass: false,
      salesPaused: false,
    });

    expect(steps.map((s) => s.bodyKey)).toContain("challengeJoin");
  });

  it("defaults to selling, so omitting the flag cannot silently hide a step", () => {
    const steps = buildLearnHubTourSteps({ ...base, hasSeasonPass: false });
    expect(steps.map((s) => s.bodyKey)).toContain("challengeJoin");
  });
});
