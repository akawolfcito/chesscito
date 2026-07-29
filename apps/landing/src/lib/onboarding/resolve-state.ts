import {
  ONBOARDING_COOKIE,
  type CarouselEntry,
  type OnboardingCookieState,
  type PreferredMode,
} from "@/lib/onboarding/types";

export interface CookieReader {
  get(name: string): { value: string } | undefined;
}

function parseMode(value: string | undefined): PreferredMode | null {
  return value === "learn" || value === "play" ? value : null;
}

/**
 * A corrupt/partial cookie pair (onboarded=true with a missing or invalid
 * preferredMode) resolves to "first-time visitor" rather than guessing a
 * destination — see docs/specs/landing-onboarding-slides.md Edge cases.
 */
export function resolveOnboardingState(
  cookies: CookieReader,
): OnboardingCookieState {
  const onboardedFlag = cookies.get(ONBOARDING_COOKIE.onboarded)?.value === "true";
  const preferredMode = parseMode(
    cookies.get(ONBOARDING_COOKIE.preferredMode)?.value,
  );

  if (!onboardedFlag || preferredMode === null) {
    return { onboarded: false, preferredMode: null };
  }

  return { onboarded: true, preferredMode };
}

/**
 * Where the carousel opens, and which half of the mode switch wears the
 * "Last used" label.
 *
 * A returning visitor lands on slide 4 — the choice screen — rather than on a
 * separate welcome screen. Slides 1-3 stay reachable with the back arrow, so
 * the shortcut costs nothing: it skips the pitch for someone who already
 * bought it, without hiding it.
 *
 * The mode drives BOTH fields, so there is no state where the carousel opens
 * on the choice screen with nothing to point at.
 */
export function carouselEntryFor(state: OnboardingCookieState): CarouselEntry {
  if (!state.onboarded || state.preferredMode === null) {
    return { initialStep: 1, lastUsedMode: null };
  }
  return { initialStep: 4, lastUsedMode: state.preferredMode };
}
