import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing, type Locale } from "./routing";

/**
 * Per-request next-intl configuration. Resolves the active locale
 * (validated against the routing whitelist) and loads its message
 * bundle. Bundles live in `lib/content/messages/{locale}.ts`.
 *
 * Stage 1: bundles are empty stubs — components still read directly
 * from `lib/content/editorial.ts` (EN-only). Stage 2 wires the
 * editorial split; Stage 3 migrates components onto `useTranslations`.
 */
/**
 * One loader per locale, stated explicitly.
 *
 * A template-literal `import()` compiles to a webpack CONTEXT module — a lazy
 * namespace matching `^\./.*$` over the whole `messages/` directory. That
 * sweeps in every sibling file, so a single test file placed next to the
 * bundles pulled vitest → vite into the Next.js server build and printed
 * "Critical dependency: Accessing import.meta directly is unsupported" on
 * every compile. Naming the two modules removes the context entirely, and the
 * Record type makes a new locale a compile error here rather than a 500 at
 * request time.
 */
type MessageModule = typeof import("@/lib/content/messages/en");

const LOADERS: Record<Locale, () => Promise<MessageModule>> = {
  en: () => import("@/lib/content/messages/en"),
  es: () => import("@/lib/content/messages/es"),
};

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const messages = (await LOADERS[locale]()).default;

  return {
    locale,
    messages,
  };
});
