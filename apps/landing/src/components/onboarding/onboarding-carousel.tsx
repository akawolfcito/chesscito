"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { SlideShell } from "@/components/onboarding/slide-shell";
import { SlideNav } from "@/components/onboarding/slide-nav";
import { LegalFooter } from "@/components/onboarding/legal-footer";
import { ModeSwitch } from "@/components/onboarding/mode-switch";
import {
  Slide1Body,
  Slide2Body,
  Slide3Body,
  Slide4Body,
} from "@/components/onboarding/slide-bodies";
import { TOTAL_SLIDES } from "@/lib/onboarding/slides";
import type { CarouselEntry, SlideStep } from "@/lib/onboarding/types";

const BODIES: Record<SlideStep, () => JSX.Element> = {
  1: Slide1Body,
  2: Slide2Body,
  3: Slide3Body,
  4: Slide4Body,
};

/**
 * Slide position is client state — no history entry per slide and no `?slide=`
 * param. Where it OPENS comes from the server (`carouselEntryFor`), so a
 * returning visitor starts on the choice screen instead of being diverted to a
 * separate welcome page.
 */
export function OnboardingCarousel({ initialStep, lastUsedMode }: CarouselEntry) {
  const [step, setStep] = useState<SlideStep>(initialStep);
  const legal = useTranslations("onboarding.legal");
  const slide1 = useTranslations("onboarding.slide1");
  const slide2 = useTranslations("onboarding.slide2");
  const slide3 = useTranslations("onboarding.slide3");
  const slide4 = useTranslations("onboarding.slide4");

  const goBack = () => setStep((s) => Math.max(1, s - 1) as SlideStep);
  const goForward = () =>
    setStep((s) => Math.min(TOTAL_SLIDES, s + 1) as SlideStep);

  const advanceLabel =
    step === 1 ? slide1("cta") : step === 2 ? slide2("cta") : slide3("cta");

  const Body = BODIES[step];

  return (
    <SlideShell
      activeStep={step}
      topSlot={
        <SlideNav
          step={step}
          total={TOTAL_SLIDES}
          onBack={goBack}
          onForward={goForward}
        />
      }
      onSwipeLeft={goForward}
      onSwipeRight={goBack}
      actionSlot={
        step < 4 ? (
          <div className="onboarding-advance-row">
            <button
              type="button"
              onClick={goForward}
              className="primary-play-cta primary-play-cta--playhub hub-scaffold-practice-cta onboarding-advance-cta"
            >
              <span className="primary-play-cta-label">{advanceLabel}</span>
            </button>
          </div>
        ) : (
          <div className="flex w-full flex-col items-center gap-1">
            <ModeSwitch lastUsedMode={lastUsedMode} />
            <span className="onboarding-switch-note">{slide4("switchNote")}</span>
          </div>
        )
      }
      footer={
        <LegalFooter
          privacyLabel={legal("privacy")}
          termsLabel={legal("terms")}
          supportLabel={legal("support")}
        />
      }
    >
      <Body />
    </SlideShell>
  );
}
