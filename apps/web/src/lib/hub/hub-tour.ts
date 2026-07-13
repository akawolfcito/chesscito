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

/** Also the `data-tour-target` attribute value the presenter measures.
 *
 *  There is deliberately NO `start-focus` step. Start Focus is the largest,
 *  brightest, most central control on the hub and it did not change — a panel
 *  explaining it spends the tour's most expensive step on the one thing nobody
 *  needs explained, and pushes the step that carries the purchase further away.
 *  The hub tour teaches the ritual, then sells the commitment. That's it. */
export type HubTourStepId = "daily" | "challenge";

export type HubTourStep = {
  id: HubTourStepId;
  target: HubTourStepId;
  /** Key into `HUB_TOUR_COPY`. */
  bodyKey:
    | "dailyStart"
    | "dailyKeep"
    | "dailyDone"
    | "challengeJoin"
    | "challengeEnrolled";
};

export type HubTourContext = {
  /** Today's Daily Tactic is already solved. */
  dailyDone: boolean;
  /** Days already strung together. A veteran mid-streak must not be told to
   *  "start your streak" — same rule as never re-selling a pass someone owns. */
  streak: number;
  /** The player holds the 21-Day pass. */
  hasSeasonPass: boolean;
};

/** Two steps: the free ritual, then the 21-day commitment. The itinerary is
 *  fixed; the COPY is what adapts. The tour reaches veterans too, so a body
 *  that assumes a fresh profile would lie to most of the people reading it. */
export function buildHubTourSteps({
  dailyDone,
  streak,
  hasSeasonPass,
}: HubTourContext): HubTourStep[] {
  return [
    {
      id: "daily",
      target: "daily",
      bodyKey: dailyDone
        ? "dailyDone"
        : streak > 0
          ? "dailyKeep"
          : "dailyStart",
    },
    {
      id: "challenge",
      target: "challenge",
      bodyKey: hasSeasonPass ? "challengeEnrolled" : "challengeJoin",
    },
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
