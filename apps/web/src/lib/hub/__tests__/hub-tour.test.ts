// apps/web/src/lib/hub/__tests__/hub-tour.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  HUB_TOUR_STORAGE_KEY,
  buildHubTourSteps,
  hasSeenHubTour,
  isHubTourLaunchable,
  markHubTourSeen,
} from "@/lib/hub/hub-tour";

describe("buildHubTourSteps", () => {
  it("walks daily → challenge → start-focus in that order", () => {
    const steps = buildHubTourSteps({ dailyDone: false, hasSeasonPass: false });
    expect(steps.map((step) => step.id)).toEqual([
      "daily",
      "challenge",
      "start-focus",
    ]);
  });

  it("sells the pending daily to a player who has not solved it today", () => {
    const [daily] = buildHubTourSteps({ dailyDone: false, hasSeasonPass: false });
    expect(daily.bodyKey).toBe("dailyPending");
  });

  it("points a solved daily at tomorrow instead of re-selling it", () => {
    const [daily] = buildHubTourSteps({ dailyDone: true, hasSeasonPass: false });
    expect(daily.bodyKey).toBe("dailyDone");
  });

  it("offers the challenge to a player without the pass", () => {
    const [, challenge] = buildHubTourSteps({
      dailyDone: false,
      hasSeasonPass: false,
    });
    expect(challenge.bodyKey).toBe("challengeJoin");
  });

  it("never re-sells the pass to a player who already bought it", () => {
    const [, challenge] = buildHubTourSteps({
      dailyDone: true,
      hasSeasonPass: true,
    });
    expect(challenge.bodyKey).toBe("challengeEnrolled");
  });

  it("names a DOM target for every step so the spotlight can measure it", () => {
    const steps = buildHubTourSteps({ dailyDone: false, hasSeasonPass: false });
    expect(steps.map((step) => step.target)).toEqual([
      "daily",
      "challenge",
      "start-focus",
    ]);
  });
});

describe("hub tour persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("treats a player who never finished the tour as not-seen", () => {
    expect(hasSeenHubTour()).toBe(false);
  });

  it("records a completed tour under the versioned key", () => {
    markHubTourSeen("completed");
    expect(hasSeenHubTour()).toBe(true);
    expect(window.localStorage.getItem(HUB_TOUR_STORAGE_KEY)).toBe("completed");
  });

  it("treats a skip as a decision, not a postponement", () => {
    markHubTourSeen("skipped");
    expect(hasSeenHubTour()).toBe(true);
    expect(window.localStorage.getItem(HUB_TOUR_STORAGE_KEY)).toBe("skipped");
  });

  it("never touches the splash key — two meanings in one key rot", () => {
    markHubTourSeen("completed");
    expect(window.localStorage.getItem("chesscito:onboarded")).toBeNull();
  });
});

describe("isHubTourLaunchable", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.body.innerHTML = "";
  });

  it("launches on a hub with no modal on screen", () => {
    expect(isHubTourLaunchable(document)).toBe(true);
  });

  it("yields to any open modal — the tour is a gate, not a competitor", () => {
    // Counted on `[aria-modal="true"]`, never on `role="dialog"`:
    // LabyrinthCompleteOverlay is a dialog with `role="alert"`.
    document.body.innerHTML = '<div aria-modal="true">Season Pass</div>';
    expect(isHubTourLaunchable(document)).toBe(false);
  });

  it("does not relaunch for a player who already saw it", () => {
    markHubTourSeen("skipped");
    expect(isHubTourLaunchable(document)).toBe(false);
  });
});
