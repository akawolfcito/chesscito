"use client";

import { useLayoutEffect, useState } from "react";
import { OnboardingCarousel } from "./onboarding-carousel";
import { carouselEntryFor, resolveOnboardingState } from "@/lib/onboarding/resolve-state";

export function OnboardingEntry() {
  const [entry, setEntry] = useState(() => carouselEntryFor({ onboarded: false, preferredMode: null }));

  useLayoutEffect(() => {
    const values = new Map(document.cookie.split(";").map((part) => {
      const [name, ...value] = part.trim().split("=");
      return [name, value.join("=")];
    }));
    setEntry(carouselEntryFor(resolveOnboardingState({
      get: (name) => values.has(name) ? { value: values.get(name)! } : undefined,
    })));
  }, []);

  return <OnboardingCarousel key={`${entry.initialStep}:${entry.lastUsedMode}`} {...entry} />;
}
