import { defineRouting } from "next-intl/routing";

/**
 * i18n routing config. Drives the middleware locale detection +
 * the `<Link>`, `useRouter`, etc. helpers from `next-intl/navigation`.
 *
 * - `locales`: every supported BCP-47 locale tag.
 * - `defaultLocale`: only the LAST-RESORT fallback when middleware
 *   detection finds no Accept-Language match AND no cookie. The vast
 *   majority of first-time visitors land on the locale that matches
 *   their browser preferences (LATAM → `es`, US → `en`).
 * - `localePrefix: "as-needed"`: the default locale (EN) serves at
 *   the root (`/`, `/hub`, ...) without a `/en/` prefix; other
 *   locales keep their prefix (`/es/`, `/es/hub`). Legacy `/en/*`
 *   URLs continue to work — next-intl canonicalizes them to the
 *   bare path with a one-hop 307. Killing the default-locale prefix
 *   eliminates the 3.5 s mobile / ~11 s desktop redirect cost
 *   documented in docs/pagespeed-report-2026-06-02.md.
 * - `localeDetection: true`: middleware reads `Accept-Language` on
 *   first hit and routes the user to the matching locale; cookie
 *   `NEXT_LOCALE` sticks the preference for subsequent visits.
 */
export const routing = defineRouting({
  locales: ["en", "es"],
  defaultLocale: "en",
  localePrefix: "as-needed",
  localeDetection: true,
});

export type Locale = (typeof routing.locales)[number];
