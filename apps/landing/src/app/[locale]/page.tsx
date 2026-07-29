import { cookies } from "next/headers";
import { OnboardingCarousel } from "@/components/onboarding/onboarding-carousel";
import {
  carouselEntryFor,
  resolveOnboardingState,
} from "@/lib/onboarding/resolve-state";

/**
 * One screen for everyone. This used to fork: a returning visitor was diverted
 * to a separate `WelcomeBack` page with its own copy, and never saw the
 * carousel again. Now they land on slide 4 — the choice screen — with their
 * previous pick labelled, and the back arrow still reaches slides 1-3. The
 * shortcut skips the pitch without hiding it.
 */
export default function Page() {
  const entry = carouselEntryFor(resolveOnboardingState(cookies()));
  return <OnboardingCarousel {...entry} />;
}
