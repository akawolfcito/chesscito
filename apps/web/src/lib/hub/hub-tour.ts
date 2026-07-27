/**
 * Shared LEARN / PLAY mini-tour.
 *
 * Each hub remembers its own tour, while Daily has one shared memory: once the
 * gift has been explained in either hub, the other tour starts with its first
 * hub-specific step. Manual replay always restores the complete itinerary.
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
  | "pro"
  | "play";

export type HubTourBodyKey =
  | "dailyStart"
  | "dailyKeep"
  | "dailyDone"
  | "challengeJoin"
  | "challengeEnrolled"
  | "rookStart"
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
  includeDaily?: boolean;
};

export type PlayHubTourContext = {
  dailyDone: boolean;
  streak: number;
  includeDaily?: boolean;
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
}: LearnHubTourContext): HubTourStep[] {
  return [
    ...(includeDaily ? [dailyStep({ dailyDone, streak })] : []),
    {
      id: "challenge" as const,
      target: "challenge" as const,
      bodyKey: hasSeasonPass
        ? ("challengeEnrolled" as const)
        : ("challengeJoin" as const),
    },
    { id: "rook", target: "rook", bodyKey: "rookStart" },
  ];
}

/** Historical export retained for local consumers while LEARN migrates. */
export const buildHubTourSteps = buildLearnHubTourSteps;

/** PLAY: shared Daily → PRO discovery/status → the primary Play tile.
 * The strip exists in every state, so the tour always explains it; only a
 * confirmed active entitlement switches the copy from discovery to status. */
export function buildPlayHubTourSteps({
  dailyDone,
  streak,
  includeDaily = true,
  proStatus,
}: PlayHubTourContext): HubTourStep[] {
  return [
    ...(includeDaily ? [dailyStep({ dailyDone, streak })] : []),
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
