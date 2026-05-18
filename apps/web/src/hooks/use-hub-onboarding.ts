import { useCallback, useEffect, useState } from "react";

export const HUB_ONBOARDING_KEY = "chesscito:hub-onboarded:v1";

export function useHubOnboarding() {
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);

  useEffect(() => {
    try {
      setHasSeenOnboarding(window.localStorage.getItem(HUB_ONBOARDING_KEY) === "true");
    } catch {
      setHasSeenOnboarding(false);
    }
  }, []);

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(HUB_ONBOARDING_KEY, "true");
      setHasSeenOnboarding(true);
    } catch {
      /* swallow */
    }
  }, []);

  return { hasSeenOnboarding, dismiss };
}
