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

/** PLAY no longer explains the Daily gift, so it needs nothing about the
 *  player's daily state — only whether the PRO strip is already active. */
export type PlayHubTourContext = {
  proStatus: "active" | "inactive" | "loading" | "error" | "unknown";
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

/** PLAY: Play Kingdom context → PRO discovery/status → the primary Play tile.
 *
 * Three fixed steps, in that order on purpose: a first-visit player is told
 * WHERE THEY ARE before they are told what to buy. The offer never leads.
 *
 * The PRO strip exists in every state, so the tour always explains it; only a
 * confirmed active entitlement switches the copy from discovery to status. */
export function buildPlayHubTourSteps({
  proStatus,
}: PlayHubTourContext): HubTourStep[] {
  return [
    { id: "kingdom", target: "kingdom", bodyKey: "kingdomBody" },
    {
      id: "pro",
      target: "pro",
      bodyKey: proStatus === "active" ? "proActive" : "proJoin",
    },
    { id: "play", target: "play", bodyKey: "playStart" },
  ];
}

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
