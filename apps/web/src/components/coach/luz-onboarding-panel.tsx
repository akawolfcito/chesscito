"use client";

import { useTranslations } from "next-intl";

import { CandyIcon } from "@/components/redesign/candy-icon";
import { Button } from "@/components/ui/button";
import type { OnboardingOutcome } from "@/lib/coach/onboarding-outcome";

type Props = {
  outcome: OnboardingOutcome;
  /** Tap on "Yes, show me" — wires the existing handleClaimWelcome
   *  flow in arena/page.tsx (sets coach-welcomed flag + dispatches
   *  the analyze call). */
  onAccept: () => void;
  /** Tap on "Not now" — soft dismiss. Per spec §3 / handoff decision
   *  C, decline does NOT persist the welcome flag, so Luz greets again
   *  on the next post-game surface. */
  onDecline: () => void;
};

/**
 * First-call onboarding for Luz. Renders the outcome-branched intro
 * + the "Yes, show me / Not now" choice. Replaces the legacy
 * CoachWelcome ("Meet Your Coach" + free-pack value card) inside the
 * coachPhase==='welcome' slot of arena/page.tsx.
 *
 * Spec: _bmad-output/planning-artifacts/coach-demo-redesign-discovery-2026-05-26.md §3
 */
export function LuzOnboardingPanel({ outcome, onAccept, onDecline }: Props) {
  const t = useTranslations("COACH_ONBOARDING_COPY");
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="relative flex items-center justify-center">
        <div className="absolute h-20 w-20 animate-pulse rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.28)_0%,rgba(217,180,74,0.12)_50%,transparent_75%)]" />
        <CandyIcon name="coach" className="relative h-12 w-12" />
      </div>

      <p
        className="text-sm leading-relaxed"
        style={{
          color: "rgba(110, 65, 15, 0.85)",
          textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
        }}
      >
        {t(`intros.${outcome}`)}
      </p>

      <div className="flex w-full gap-2">
        <Button
          type="button"
          variant="game-ghost"
          size="game-sm"
          onClick={onDecline}
          className="flex-1"
        >
          {t("ctaDecline")}
        </Button>
        <Button
          type="button"
          variant="game-solid"
          size="game-sm"
          onClick={onAccept}
          className="flex-1"
        >
          {t("ctaAccept")}
        </Button>
      </div>
    </div>
  );
}
