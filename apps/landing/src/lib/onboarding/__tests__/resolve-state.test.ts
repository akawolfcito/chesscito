import { describe, expect, it } from "vitest";
import {
  carouselEntryFor,
  resolveOnboardingState,
  type CookieReader,
} from "@/lib/onboarding/resolve-state";

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

describe("carouselEntryFor", () => {
  it("opens a first-time visitor on slide 1 with no label", () => {
    expect(carouselEntryFor({ onboarded: false, preferredMode: null })).toEqual({
      initialStep: 1,
      lastUsedMode: null,
    });
  });

  it("drops a returning visitor straight onto slide 4, label on their mode", () => {
    expect(carouselEntryFor({ onboarded: true, preferredMode: "play" })).toEqual({
      initialStep: 4,
      lastUsedMode: "play",
    });
  });

  // The corrupt-cookie case is already normalised by resolveOnboardingState,
  // but this function is exported on its own, so it must not trust its input:
  // `onboarded` without a mode has no half to label, and labelling neither
  // while still landing on slide 4 would show a choice screen that silently
  // claims the visitor never chose.
  it("treats onboarded-without-a-mode as first-time", () => {
    expect(carouselEntryFor({ onboarded: true, preferredMode: null })).toEqual({
      initialStep: 1,
      lastUsedMode: null,
    });
  });
});
