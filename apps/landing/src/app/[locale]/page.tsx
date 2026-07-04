import { cookies } from "next/headers";
import { OnboardingCarousel } from "@/components/onboarding/onboarding-carousel";
import { WelcomeBack } from "@/components/onboarding/welcome-back";
import { resolveOnboardingState } from "@/lib/onboarding/resolve-state";

export default function Page() {
  const state = resolveOnboardingState(cookies());

  if (state.onboarded && state.preferredMode) {
    return <WelcomeBack preferredMode={state.preferredMode} />;
  }

  return <OnboardingCarousel />;
}
