/**
 * Non-translated visual contract for the 4 onboarding slides — asset paths
 * only. Translated copy lives in lib/content/messages/{locale}.ts under the
 * matching `onboarding.slideN` key.
 *
 * Mirrored by the theme registry (apps/web · lib/themes/theme-registry.ts,
 * `landing.slide*` slots) so every file here is replaceable from the theme
 * builder. THIS FILE is the source of truth for the paths; the registry
 * follows it, never the other way round.
 */

import type { Locale } from "@/i18n/routing";
import type { SlideStep } from "@/lib/onboarding/types";

export const TOTAL_SLIDES = 4;

export interface SlideVisual {
  step: SlideStep;
  /** Full-bleed illustration, extensionless (ArtImage appends avif/webp/png). */
  backgroundSrc: string;
  /**
   * Title art per locale. Slide 1 points at the SAME file for both — the
   * CHESSCITO wordmark is not translated. A complete Record rather than an
   * optional with a fallback: adding a locale must fail in types, not render
   * English in silence.
   */
  titleSrc: Record<Locale, string>;
}

/**
 * ⚠️ Every path below is a WHOLE string literal. Do not factor the shared
 * directory prefix into a constant and interpolate it: the theme catalog's
 * coverage audit greps this source for art-path literals, and a composed path
 * is invisible to it (`landing-assets.test.ts` — "leaves no landing image
 * outside the catalog"). The art would then be uncataloged and unreplaceable
 * from the theme builder, and nothing would say so.
 *
 * The same scanner reads comments, so prose here must not spell out a path
 * either — a mention would be counted as an asset that does not exist.
 */
export const SLIDE_VISUALS: Readonly<Record<SlideStep, SlideVisual>> = {
  1: {
    step: 1,
    backgroundSrc: "/art/landing-slides/slide-bg-1",
    titleSrc: {
      en: "/art/landing-slides/title-chesscito",
      es: "/art/landing-slides/title-chesscito",
    },
  },
  2: {
    step: 2,
    backgroundSrc: "/art/landing-slides/slide-bg-2",
    titleSrc: {
      en: "/art/landing-slides/title-learn-en",
      es: "/art/landing-slides/title-learn-es",
    },
  },
  3: {
    step: 3,
    backgroundSrc: "/art/landing-slides/slide-bg-3",
    titleSrc: {
      en: "/art/landing-slides/title-play-en",
      es: "/art/landing-slides/title-play-es",
    },
  },
  4: {
    step: 4,
    backgroundSrc: "/art/landing-slides/slide-bg-4",
    titleSrc: {
      en: "/art/landing-slides/title-choose-en",
      es: "/art/landing-slides/title-choose-es",
    },
  },
} as const;

/** Every step, in order. The carousel iterates this to mount all four
 *  backgrounds at once — see the shell's cross-fade. */
export const SLIDE_STEPS: readonly SlideStep[] = [1, 2, 3, 4] as const;

export const ICONS = {
  learn: "/art/hub/train-pieces",
  play: "/art/redesign/banners/btn-battle",
  seasonPass: "/art/landing-slides/season-pass-icon",
  pro: "/art/landing-slides/pro-suscription-icon",
} as const;
