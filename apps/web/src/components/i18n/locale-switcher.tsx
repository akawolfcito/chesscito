"use client";

import { useLocale, useTranslations } from "next-intl";

import { routing, type Locale } from "@/i18n/routing";

/** Persist the user's choice for one year so subsequent visits skip
 *  Accept-Language detection. Same-site lax matches Next-intl's own
 *  cookie semantics (the middleware reads NEXT_LOCALE on first hit). */
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const LOCALE_NATIVE_NAMES: Record<Locale, string> = {
  en: "English",
  es: "Español",
};

/** Segmented locale switcher rendered inside `<AccountSheet>` (above
 *  the disconnect button). Both options stay visible at once so the
 *  user reads the destination language in its native form. Persisting
 *  the cookie keeps the choice across visits while the middleware's
 *  Accept-Language detection still handles first-time anonymous hits.
 *
 *  Uses `@/i18n/navigation` so next-intl owns the locale-segment swap
 *  (replaces the previous in-house regex). `pathname` from this module
 *  returns the locale-stripped path (`/hub` rather than `/en/hub`), so
 *  passing it back into `router.replace(path, { locale })` paints the
 *  destination locale cleanly without manual string surgery. */
export function LocaleSwitcher() {
  const t = useTranslations("ACCOUNT_SHEET_COPY");
  const locale = useLocale() as Locale;

  function selectLocale(next: Locale) {
    if (next === locale) return;
    if (typeof window === "undefined") return;
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
    // Read the raw URL directly and strip any existing locale segment, then
    // prepend the new locale. Doing this from window.location (instead of
    // next-intl's usePathname) avoids router edge cases where pathname
    // could return null or already include the locale, which caused the
    // hard navigation to land back on the same locale.
    const current = window.location.pathname;
    const localeRegex = new RegExp(`^/(${routing.locales.join("|")})(?=/|$)`);
    const stripped = current.replace(localeRegex, "") || "/";
    const target = `/${next}${stripped === "/" ? "" : stripped}${window.location.search}${window.location.hash}`;
    window.location.assign(target);
  }

  return (
    <div
      role="group"
      aria-label={t("languageLabel")}
      className="inline-grid grid-cols-2 gap-0.5 rounded-lg p-0.5"
      style={{ background: "rgba(110, 65, 15, 0.10)" }}
    >
      {routing.locales.map((option) => {
        const isActive = option === locale;
        const shortLabel = option === "en" ? "EN" : "ES";
        return (
          <button
            key={option}
            type="button"
            onClick={() => selectLocale(option)}
            aria-pressed={isActive}
            aria-label={t("languageSwitchAriaFormat", {
              name: LOCALE_NATIVE_NAMES[option],
            })}
            className="rounded-md px-2 py-0.5 text-xs font-bold transition active:scale-95"
            style={{
              background: isActive ? "rgba(245, 158, 11, 0.85)" : "transparent",
              color: isActive ? "rgba(63, 34, 8, 0.95)" : "rgba(110, 65, 15, 0.75)",
              textShadow: isActive
                ? "0 1px 0 rgba(255, 245, 215, 0.55)"
                : undefined,
              boxShadow: isActive
                ? "0 0 0 1px rgba(245, 158, 11, 0.55), inset 0 1px 0 rgba(255, 245, 215, 0.35)"
                : undefined,
            }}
          >
            {shortLabel}
          </button>
        );
      })}
    </div>
  );
}
