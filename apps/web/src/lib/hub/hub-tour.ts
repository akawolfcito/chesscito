/**
 * Hub Tour (LEARN) — the 3-step introduction to the Daily-first hub.
 * Spec: docs/specs/2026-07-12-hub-tour-daily-first-spec.md
 *
 * Pure logic only: which steps a player gets, and whether the tour may run.
 * The presenter (`components/hub/hub-tour.tsx`) owns the spotlight.
 */

/** Versioned. When the hub changes shape again, `v2` ships itself without
 *  rewriting anyone's history — and WITHOUT touching `chesscito:onboarded`,
 *  which `use-splash-loader.ts` owns. Two meanings in one key rot the day
 *  either one moves. */
export const HUB_TOUR_STORAGE_KEY = "chesscito:hub-tour:v1";

export type HubTourOutcome = "completed" | "skipped";

/** Also the `data-tour-target` attribute value the presenter measures. */
export type HubTourStepId = "daily" | "challenge" | "start-focus";

export type HubTourStep = {
  id: HubTourStepId;
  target: HubTourStepId;
  /** Key into `HUB_TOUR_COPY`. */
  bodyKey:
    | "dailyPending"
    | "dailyDone"
    | "challengeJoin"
    | "challengeEnrolled"
    | "startFocus";
};

export type HubTourContext = {
  /** Today's Daily Tactic is already solved. */
  dailyDone: boolean;
  /** The player holds the 21-Day pass. */
  hasSeasonPass: boolean;
};

/** Every player gets all three steps — the copy adapts, the itinerary does not.
 *  Since the tour reaches veterans too, many already hold the pass or already
 *  solved today's daily; selling either one back to them is a lie. */
export function buildHubTourSteps({
  dailyDone,
  hasSeasonPass,
}: HubTourContext): HubTourStep[] {
  return [
    {
      id: "daily",
      target: "daily",
      bodyKey: dailyDone ? "dailyDone" : "dailyPending",
    },
    {
      id: "challenge",
      target: "challenge",
      bodyKey: hasSeasonPass ? "challengeEnrolled" : "challengeJoin",
    },
    { id: "start-focus", target: "start-focus", bodyKey: "startFocus" },
  ];
}

export function hasSeenHubTour(): boolean {
  try {
    return window.localStorage.getItem(HUB_TOUR_STORAGE_KEY) !== null;
  } catch {
    // Private mode / WebView with storage disabled. Treat as seen: a tour that
    // cannot remember being dismissed would relaunch on every hub mount.
    return true;
  }
}

/** Written ONLY on completion or skip. A tour abandoned mid-way is not a tour
 *  given, so a cold start puts the player back on step 1. */
export function markHubTourSeen(outcome: HubTourOutcome): void {
  try {
    window.localStorage.setItem(HUB_TOUR_STORAGE_KEY, outcome);
  } catch {
    // Nothing to do — the tour already ran; losing the flag costs one replay.
  }
}

/** The tour is a GATE: it never opens on top of another modal (the season-pass
 *  sheet, the daily sheet, a celebration). Counted on `[aria-modal="true"]` and
 *  never on `role="dialog"` — `LabyrinthCompleteOverlay` is a dialog carrying
 *  `role="alert"`, so counting roles reports "clear" with a modal on screen. */
export function isHubTourLaunchable(doc: Document): boolean {
  if (hasSeenHubTour()) return false;
  return doc.querySelectorAll('[aria-modal="true"]').length === 0;
}
