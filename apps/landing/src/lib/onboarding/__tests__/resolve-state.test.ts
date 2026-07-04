import { describe, expect, it } from "vitest";
import { resolveOnboardingState, type CookieReader } from "@/lib/onboarding/resolve-state";

function makeCookies(values: Record<string, string>): CookieReader {
  return {
    get: (name) => (name in values ? { value: values[name] } : undefined),
  };
}

describe("resolveOnboardingState", () => {
  it("treats a visitor with no cookies as first-time", () => {
    const state = resolveOnboardingState(makeCookies({}));
    expect(state).toEqual({ onboarded: false, preferredMode: null });
  });

  it("resolves a valid onboarded cookie pair", () => {
    const state = resolveOnboardingState(
      makeCookies({
        chesscito_onboarded: "true",
        chesscito_preferred_mode: "learn",
      }),
    );
    expect(state).toEqual({ onboarded: true, preferredMode: "learn" });
  });

  it("falls back to first-time when preferredMode is missing (corrupt cookie)", () => {
    const state = resolveOnboardingState(
      makeCookies({ chesscito_onboarded: "true" }),
    );
    expect(state).toEqual({ onboarded: false, preferredMode: null });
  });

  it("falls back to first-time when preferredMode is an invalid value", () => {
    const state = resolveOnboardingState(
      makeCookies({
        chesscito_onboarded: "true",
        chesscito_preferred_mode: "bogus",
      }),
    );
    expect(state).toEqual({ onboarded: false, preferredMode: null });
  });

  it("ignores a preferredMode cookie without the onboarded flag", () => {
    const state = resolveOnboardingState(
      makeCookies({ chesscito_preferred_mode: "play" }),
    );
    expect(state).toEqual({ onboarded: false, preferredMode: null });
  });
});
