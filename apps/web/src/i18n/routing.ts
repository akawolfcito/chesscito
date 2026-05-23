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
 * - `localePrefix: "always"`: every URL carries `/en/` or `/es/` so
 *   both audiences are first-class. Naked `/` gets redirected.
 * - `localeDetection: true`: middleware reads `Accept-Language` on
 *   first hit and routes the user to the matching locale; cookie
 *   `NEXT_LOCALE` sticks the preference for subsequent visits.
 */
export const routing = defineRouting({
  locales: ["en", "es"],
  defaultLocale: "en",
  localePrefix: "always",
  localeDetection: true,
});

export type Locale = (typeof routing.locales)[number];
