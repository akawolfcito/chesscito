import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

/**
 * Per-request next-intl configuration. Resolves the active locale
 * (validated against the routing whitelist) and loads its message
 * bundle. Bundles live in `lib/content/messages/{locale}.ts`.
 *
 * Stage 1: bundles are empty stubs — components still read directly
 * from `lib/content/editorial.ts` (EN-only). Stage 2 wires the
 * editorial split; Stage 3 migrates components onto `useTranslations`.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const messages = (await import(`@/lib/content/messages/${locale}`)).default;

  return {
    locale,
    messages,
  };
});
