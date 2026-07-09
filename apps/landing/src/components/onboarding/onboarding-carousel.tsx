"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { SlideShell } from "@/components/onboarding/slide-shell";
import { SlideNav } from "@/components/onboarding/slide-nav";
import { LegalFooter } from "@/components/onboarding/legal-footer";
import {
  Slide1Body,
  Slide2Body,
  Slide3Body,
  Slide4Body,
} from "@/components/onboarding/slide-bodies";

const TOTAL_SLIDES = 4;

/**
 * Slide position is pure client state — no history entry per slide, no
 * `?slide=` param (spec Behavior #10). Reloading mid-carousel resets to
 * slide 1; browser Back leaves `/` entirely.
 */
export function OnboardingCarousel() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const legal = useTranslations("onboarding.legal");
  const slide1 = useTranslations("onboarding.slide1");
  const slide2 = useTranslations("onboarding.slide2");
  const slide3 = useTranslations("onboarding.slide3");
  const slide4 = useTranslations("onboarding.slide4");

  const advanceLabel =
    step === 1 ? slide1("cta") : step === 2 ? slide2("cta") : slide3("cta");

  const goBack = () => setStep((current) => (Math.max(1, current - 1) as 1 | 2 | 3 | 4));
  const goForward = () =>
    setStep((current) => (Math.min(TOTAL_SLIDES, current + 1) as 1 | 2 | 3 | 4));

  return (
    <SlideShell
      topSlot={<SlideNav step={step} total={TOTAL_SLIDES} onBack={goBack} onForward={goForward} />}
      onSwipeLeft={goForward}
      onSwipeRight={goBack}
      ctaSlot={
        step < 4 ? (
          <button
            type="button"
            onClick={goForward}
            className="primary-play-cta primary-play-cta--playhub hub-scaffold-practice-cta"
          >
            <span className="primary-play-cta-label">{advanceLabel}</span>
          </button>
        ) : (
          // Slide 4's own CTA, sitting exactly where START and NEXT sat on
          // the three slides before it. Its escape link stays inside the
          // frame, above this button: a thumb overshooting the CTA then
          // lands on empty meadow rather than on Play.
          <a
            href="/api/enter?mode=learn"
            className="primary-play-cta primary-play-cta--playhub hub-scaffold-practice-cta"
          >
            <span className="primary-play-cta-label">
              {slide4("startLearning")}
            </span>
          </a>
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
      {step === 1 && <Slide1Body />}
      {step === 2 && <Slide2Body />}
      {step === 3 && <Slide3Body />}
      {step === 4 && <Slide4Body />}
    </SlideShell>
  );
}
