export type PreferredMode = "learn" | "play";

export const ONBOARDING_COOKIE = {
  onboarded: "chesscito_onboarded",
  preferredMode: "chesscito_preferred_mode",
} as const;

export interface OnboardingCookieState {
  onboarded: boolean;
  preferredMode: PreferredMode | null;
}

/** The four onboarding slides. Narrow on purpose: a fifth step has to be a
 *  type change, not a number that silently indexes past the assets. */
export type SlideStep = 1 | 2 | 3 | 4;

/**
 * What the server page hands the client carousel. Derived from
 * `OnboardingCookieState`, which is unchanged — this is a second reading of
 * the same cookies, not a second source of truth.
 */
export interface CarouselEntry {
  /** Where the carousel opens. 4 when a preference exists, 1 otherwise. */
  initialStep: SlideStep;
  /** Which half of the mode switch carries the "Last used" label. */
  lastUsedMode: PreferredMode | null;
}
