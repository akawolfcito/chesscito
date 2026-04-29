import React from "react";
import {
  PITCH_A_COPY_LOCALES,
  PITCH_B_COPY_LOCALES,
  PITCH_BRAND_LOCALES,
  PITCH_BRAND_STATIC,
  PITCH_TEAM_LOCALES,
  type PitchLocale,
} from "./pitch-copy";

/**
 * v3.9 — i18n support for the pitch video.
 *
 * Each Composition (`ChesscitoPitch`, `ChesscitoPitchCaregiver`)
 * accepts a `locale` prop ("es" | "en"), wraps its tree with this
 * provider, and every scene + shared helper reads localized copy
 * via the `useBrand`, `useTeam`, `useACopy`, `useBCopy` hooks.
 *
 * In Remotion Studio the prop appears in the schema panel and can
 * be flipped without re-rendering the layout — the composition
 * stays identical, only the strings change.
 */

const PitchLocaleContext = React.createContext<PitchLocale>("es");

export const PitchLocaleProvider: React.FC<{
  locale: PitchLocale;
  children: React.ReactNode;
}> = ({ locale, children }) => (
  <PitchLocaleContext.Provider value={locale}>
    {children}
  </PitchLocaleContext.Provider>
);

export const usePitchLocale = (): PitchLocale =>
  React.useContext(PitchLocaleContext);

/** Merged brand object: static fields + locale-dependent strings. */
export const useBrand = () => {
  const locale = usePitchLocale();
  return { ...PITCH_BRAND_STATIC, ...PITCH_BRAND_LOCALES[locale] };
};

/** Founder array localized — names stay, role + tagline switch. */
export const useTeam = () => {
  const locale = usePitchLocale();
  return PITCH_TEAM_LOCALES[locale];
};

/** A-Cut copy tree (scenes + variantLabel + duration) localized. */
export const useACopy = () => {
  const locale = usePitchLocale();
  return PITCH_A_COPY_LOCALES[locale];
};

/** B-Cut copy tree localized. */
export const useBCopy = () => {
  const locale = usePitchLocale();
  return PITCH_B_COPY_LOCALES[locale];
};
