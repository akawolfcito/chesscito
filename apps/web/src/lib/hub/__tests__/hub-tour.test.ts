import { beforeEach, describe, expect, it } from "vitest";

import {
  HUB_TOUR_DAILY_STORAGE_KEY,
  HUB_TOUR_STORAGE_KEYS,
  buildLearnHubTourSteps,
  buildPlayHubTourSteps,
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

  it("teaches PLAY as context → offer → action, never sale-first", () => {
    expect(
      buildPlayHubTourSteps({ proStatus: "inactive" }).map((step) => step.id),
    ).toEqual(["kingdom", "pro", "play"]);
  });

  it("never puts the PRO offer before the Play Kingdom context", () => {
    const ids = buildPlayHubTourSteps({ proStatus: "inactive" }).map(
      (step) => step.id,
    );
    expect(ids.indexOf("kingdom")).toBeLessThan(ids.indexOf("pro"));
    expect(ids.indexOf("pro")).toBeLessThan(ids.indexOf("play"));
  });

  it("keeps PLAY at three steps in every entitlement state", () => {
    for (const proStatus of [
      "active",
      "inactive",
      "loading",
      "error",
      "unknown",
    ] as const) {
      expect(buildPlayHubTourSteps({ proStatus })).toHaveLength(3);
    }
  });

  it("no longer spends a PLAY step on the Daily gift — LEARN owns it", () => {
    const ids = buildPlayHubTourSteps({ proStatus: "inactive" }).map(
      (step) => step.id,
    );
    expect(ids).not.toContain("daily");
  });

  it("still narrates the visible PRO strip while entitlement is unknown", () => {
    expect(
      buildPlayHubTourSteps({ proStatus: "unknown" }).map((step) => step.id),
    ).toEqual(["kingdom", "pro", "play"]);
  });

  it("never re-sells PRO to an active subscriber", () => {
    const proStep = buildPlayHubTourSteps({ proStatus: "active" }).find(
      (step) => step.id === "pro",
    );
    expect(proStep?.bodyKey).toBe("proActive");
  });
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
