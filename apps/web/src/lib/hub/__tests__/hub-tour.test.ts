// apps/web/src/lib/hub/__tests__/hub-tour.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  HUB_TOUR_STORAGE_KEY,
  buildHubTourSteps,
  hasSeenHubTour,
  isHubTourLaunchable,
  markHubTourSeen,
} from "@/lib/hub/hub-tour";

const FRESH = { dailyDone: false, streak: 0, hasSeasonPass: false };

describe("buildHubTourSteps", () => {
  it("teaches the free ritual, then sells the commitment — and stops there", () => {
    expect(buildHubTourSteps(FRESH).map((step) => step.id)).toEqual([
      "daily",
      "challenge",
    ]);
  });

  it("never spends a step on Start Focus — the biggest button on the hub needs no panel", () => {
    const targets = buildHubTourSteps(FRESH).map((step) => step.target);
    expect(targets).not.toContain("start-focus");
  });

  it("invites a fresh profile to START a streak", () => {
    const [daily] = buildHubTourSteps(FRESH);
    expect(daily.bodyKey).toBe("dailyStart");
  });

  it("invites a veteran mid-streak to KEEP it, never to start one", () => {
    const [daily] = buildHubTourSteps({ ...FRESH, streak: 12 });
    expect(daily.bodyKey).toBe("dailyKeep");
  });

  it("points a solved daily at tomorrow instead of re-selling it", () => {
    const [daily] = buildHubTourSteps({ ...FRESH, dailyDone: true, streak: 3 });
    expect(daily.bodyKey).toBe("dailyDone");
  });

  it("offers the challenge to a player without the pass", () => {
    const [, challenge] = buildHubTourSteps(FRESH);
    expect(challenge.bodyKey).toBe("challengeJoin");
  });

  it("never re-sells the pass to a player who already bought it", () => {
    const [, challenge] = buildHubTourSteps({ ...FRESH, hasSeasonPass: true });
    expect(challenge.bodyKey).toBe("challengeEnrolled");
  });

  it("names a DOM target for every step so the spotlight can measure it", () => {
    expect(buildHubTourSteps(FRESH).map((step) => step.target)).toEqual([
      "daily",
      "challenge",
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
