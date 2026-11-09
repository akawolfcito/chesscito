"use client";

import { useLocale, useTranslations } from "next-intl";
import { routing, type Locale } from "@/i18n/routing";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const NATIVE_NAMES: Record<Locale, string> = {
  en: "English",
  es: "Español",
};

const SHORT_LABELS: Record<Locale, string> = {
  en: "EN",
  es: "ES",
};

/**
 * Both options stay visible so the visitor reads the destination language in
 * its own form.
 *
 * ⚠️ `localePrefix` is "as-needed" (i18n/routing.ts): English lives at `/`
 * with NO prefix, Spanish at `/es`. The sibling app's LocaleSwitcher always
 * prepends the locale, which here would send English to `/en` — a URL the
 * middleware only redirects away from, costing a hop and offering a second
 * address for the same page.
 */
export function LocaleSwitch() {
  const t = useTranslations("onboarding.language");
  const locale = useLocale() as Locale;

  function hrefFor(next: Locale): string {
    return next === routing.defaultLocale ? "/" : `/${next}`;
  }

  function selectLocale(next: Locale) {
    if (next === locale) return;
    if (typeof window === "undefined") return;
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
    window.location.assign(hrefFor(next));
  }

  return (
    <div className="onboarding-locale-switch" role="group" aria-label={t("label")}>
      {routing.locales.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => selectLocale(option)}
          data-active={option === locale ? "true" : undefined}
          aria-label={t("switchTo", { name: NATIVE_NAMES[option] })}
          className="onboarding-locale-switch-option"
        >
          {SHORT_LABELS[option]}
        </button>
      ))}
    </div>
  );
}
