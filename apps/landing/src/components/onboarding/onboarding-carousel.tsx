"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { SlideShell } from "@/components/onboarding/slide-shell";
import { ProgressPill } from "@/components/onboarding/progress-pill";
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

  const advanceLabel =
    step === 1 ? slide1("cta") : step === 2 ? slide2("cta") : slide3("cta");

  return (
    <SlideShell
      topSlot={
        step < 4 ? <ProgressPill current={step} total={TOTAL_SLIDES} /> : null
      }
      ctaSlot={
        step < 4 ? (
          <button
            type="button"
            onClick={() => setStep((current) => (current + 1) as 1 | 2 | 3 | 4)}
            className="primary-play-cta primary-play-cta--playhub hub-scaffold-practice-cta"
          >
            <span className="primary-play-cta-label">{advanceLabel}</span>
          </button>
        ) : null
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
