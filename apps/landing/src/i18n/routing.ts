import { defineRouting } from "next-intl/routing";

/**
 * Scoped to the onboarding route ("/") only — `/classic` and `/stats`
 * are excluded from locale routing entirely (see middleware.ts matcher),
 * staying exactly as they behave today.
 */
export const routing = defineRouting({
  locales: ["en", "es"],
  defaultLocale: "en",
  localePrefix: "as-needed",
  localeDetection: true,
});

export type Locale = (typeof routing.locales)[number];
