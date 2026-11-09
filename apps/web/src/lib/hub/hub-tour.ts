/**
 * Shared LEARN / PLAY mini-tour.
 *
 * Each hub remembers its own tour. The Daily gift is explained by LEARN only —
 * it is LEARN's ritual, and PLAY's three steps are spent on context → offer →
 * action instead (2026-07-28 spec). The shared Daily memory therefore has a
 * single writer now; it stays because manual replay still passes through it.
 */

export type HubTourMode = "learn" | "play";
export type HubTourOutcome = "completed" | "skipped";

export const HUB_TOUR_STORAGE_KEYS: Record<HubTourMode, string> = {
  learn: "chesscito:hub-tour:learn:v2",
  play: "chesscito:hub-tour:play:v1",
};
export const HUB_TOUR_DAILY_STORAGE_KEY = "chesscito:hub-tour:daily:v1";
/** Backwards-compatible name for LEARN call sites/tests. */
export const HUB_TOUR_STORAGE_KEY = HUB_TOUR_STORAGE_KEYS.learn;

export type HubTourStepId =
  | "daily"
  | "challenge"
  | "rook"
  | "kingdom"
  | "pro"
  | "play";

export type HubTourBodyKey =
  | "dailyStart"
  | "dailyKeep"
  | "dailyDone"
  | "challengeJoin"
  | "challengeEnrolled"
  | "rookStart"
  | "kingdomBody"
  | "proJoin"
  | "proActive"
  | "playStart";

export type HubTourStep = {
  id: HubTourStepId;
  target: HubTourStepId;
  bodyKey: HubTourBodyKey;
};

export type LearnHubTourContext = {
  dailyDone: boolean;
  streak: number;
  hasSeasonPass: boolean;
  /** Season Pass sales paused. Drops the purchase step for anyone who does
   *  not already own the pass. Defaults false so forgetting it cannot hide a
   *  step by accident. */
  salesPaused?: boolean;
  includeDaily?: boolean;
};

function dailyStep({
  dailyDone,
  streak,
}: Pick<LearnHubTourContext, "dailyDone" | "streak">): HubTourStep {
  return {
    id: "daily",
    target: "daily",
    bodyKey: dailyDone
      ? "dailyDone"
      : streak > 0
        ? "dailyKeep"
        : "dailyStart",
  };
}

/** LEARN: Daily (when still new) → Focus Passport → Rook. */
export function buildLearnHubTourSteps({
  dailyDone,
  streak,
  hasSeasonPass,
  includeDaily = true,
  salesPaused = false,
}: LearnHubTourContext): HubTourStep[] {
  /* ⛔ THE TOUR IS A FUNNEL, AND THE PAUSE HAS TO REACH IT TOO.
   *
   * Hiding the card's purchase banner left this step still saying "Join the
   * 21-Day Challenge — $0.99, one-time payment" to every new player on step 2
   * of 3. The pause had been applied to the surface and not to the thing
   * pointing at it (founder, 2026-08-26).
   *
   * The step exists to sell, so with no sale there is nothing for it to say:
   * the daily step already explains the streak, and the panel it targets is now
   * the habit panel, which needs no pitch. Somebody who ALREADY owns the pass
   * still gets their step — explaining what they bought is not a sale. */
  const sellsThePass = !hasSeasonPass;
  const skipChallengeStep = salesPaused && sellsThePass;

  return [
    ...(includeDaily ? [dailyStep({ dailyDone, streak })] : []),
    ...(skipChallengeStep
      ? []
      : [
          {
            id: "challenge" as const,
            target: "challenge" as const,
            bodyKey: hasSeasonPass
              ? ("challengeEnrolled" as const)
              : ("challengeJoin" as const),
          },
        ]),
    { id: "rook", target: "rook", bodyKey: "rookStart" },
  ];
}

/** Historical export retained for local consumers while LEARN migrates. */
export const buildHubTourSteps = buildLearnHubTourSteps;

/* ⛔ `buildPlayHubTourSteps` was removed on 2026-08-30 with the PLAY mini-tour.
 *
 * Its three steps had each lost their subject: step 1 explained the Kingdom
 * card (deleted — it was onboarding copy standing in for a world render that
 * now ships), step 2 sold PRO at $1.99 to a population where 59,6% of the
 * people reaching the PRO sheet hold no stablecoin, and step 3 pointed at a
 * rail tile that is now a 60px-tall CTA in the middle of the screen.
 *
 * Its measured "lift" did not survive inspection: 64,6% of tour-finishers
 * start a match against 21,9% of those who never saw it, but the never-saw-it
 * group is 169 people out of 6.177 — essentially those who left before it
 * could render — and the cohort that saw it and quit converts at 4,4%. That is
 * selection, not causation.
 *
 * LEARN keeps its tour: `buildLearnHubTourSteps` is untouched, and the
 * first-activity experiment latches on the LEARN storage key, not this one. */

export function hasSeenHubTour(mode: HubTourMode = "learn"): boolean {
  try {
    return window.localStorage.getItem(HUB_TOUR_STORAGE_KEYS[mode]) !== null;
  } catch {
    return true;
  }
}

export function hasSeenDailyTour(): boolean {
  try {
    return window.localStorage.getItem(HUB_TOUR_DAILY_STORAGE_KEY) !== null;
  } catch {
    return true;
  }
}

export function markHubTourSeen(
  outcome: HubTourOutcome,
  mode: HubTourMode = "learn",
  includedDaily = false,
): void {
  try {
    window.localStorage.setItem(HUB_TOUR_STORAGE_KEYS[mode], outcome);
    if (includedDaily) {
      window.localStorage.setItem(HUB_TOUR_DAILY_STORAGE_KEY, outcome);
    }
  } catch {
    // A disabled WebView store costs at most one replay next mount.
  }
}

export function isHubTourLaunchable(
  doc: Document,
  mode: HubTourMode = "learn",
): boolean {
  if (hasSeenHubTour(mode)) return false;
  return doc.querySelectorAll('[aria-modal="true"]').length === 0;
}
