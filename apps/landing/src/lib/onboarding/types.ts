export type PreferredMode = "learn" | "play";

export const ONBOARDING_COOKIE = {
  onboarded: "chesscito_onboarded",
  preferredMode: "chesscito_preferred_mode",
} as const;

export interface OnboardingCookieState {
  onboarded: boolean;
  preferredMode: PreferredMode | null;
}
