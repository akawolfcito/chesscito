import { beforeEach, describe, expect, it } from "vitest";

import {
  HUB_TOUR_DAILY_STORAGE_KEY,
  HUB_TOUR_STORAGE_KEYS,
  buildLearnHubTourSteps,
  hasSeenDailyTour,
  hasSeenHubTour,
  isHubTourLaunchable,
  markHubTourSeen,
} from "@/lib/hub/hub-tour";

const FRESH = { dailyDone: false, streak: 0, hasSeasonPass: false };

describe("tour itineraries", () => {
  it("teaches LEARN as Daily → Challenge → Rook", () => {
    expect(buildLearnHubTourSteps(FRESH).map((step) => step.id)).toEqual([
      "daily",
      "challenge",
      "rook",
    ]);
  });

  it("removes only the shared Daily step after another hub introduced it", () => {
    expect(
      buildLearnHubTourSteps({ ...FRESH, includeDaily: false }).map(
        (step) => step.id,
      ),
    ).toEqual(["challenge", "rook"]);
  });

  it("adapts LEARN copy to progress and ownership", () => {
    const veteran = buildLearnHubTourSteps({
      dailyDone: true,
      streak: 12,
      hasSeasonPass: true,
    });
    expect(veteran[0]?.bodyKey).toBe("dailyDone");
    expect(veteran[1]?.bodyKey).toBe("challengeEnrolled");
  });

  /* The PLAY itinerary was removed on 2026-08-30 along with the mini-tour.
   *  Its three steps had lost their subject: the Kingdom card is deleted, the
   *  PRO step sold $1.99 to a population 59,6% of which holds no stablecoin,
   *  and the "play" step pointed at a rail tile that is now the primary CTA.
   *  LEARN keeps its itinerary, which is what the tests above cover. */
});

describe("shared tour persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.body.innerHTML = "";
  });

  it("stores each hub independently and Daily only when it was included", () => {
    markHubTourSeen("completed", "learn", true);
    expect(hasSeenHubTour("learn")).toBe(true);
    expect(hasSeenHubTour("play")).toBe(false);
    expect(hasSeenDailyTour()).toBe(true);
    expect(window.localStorage.getItem(HUB_TOUR_DAILY_STORAGE_KEY)).toBe(
      "completed",
    );

    markHubTourSeen("skipped", "play", false);
    expect(window.localStorage.getItem(HUB_TOUR_STORAGE_KEYS.play)).toBe(
      "skipped",
    );
  });

  it("never touches the unrelated splash onboarding key", () => {
    markHubTourSeen("completed", "learn", true);
    expect(window.localStorage.getItem("chesscito:onboarded")).toBeNull();
  });

  it("yields to another modal and to an already-seen mode", () => {
    document.body.innerHTML = '<div aria-modal="true">Sheet</div>';
    expect(isHubTourLaunchable(document, "play")).toBe(false);

    document.body.innerHTML = "";
    expect(isHubTourLaunchable(document, "play")).toBe(true);
    markHubTourSeen("completed", "play");
    expect(isHubTourLaunchable(document, "play")).toBe(false);
  });
});
