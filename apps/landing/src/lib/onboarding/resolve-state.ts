import {
  ONBOARDING_COOKIE,
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
