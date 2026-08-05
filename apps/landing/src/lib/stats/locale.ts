/**
 * Locale for `/stats` — resolved WITHOUT a route segment.
 *
 * ⛔ `/stats` stays outside the next-intl middleware matcher on purpose. Two
 * indexable URLs for the same content is one more than the MiniPay listing can
 * declare, so there is no `/en/stats` and no `/es/stats`. The language is a
 * PRESENTATION concern here: `?locale=` overrides, otherwise `Accept-Language`.
 *
 * ⚠️ `locale` must never reach the aggregator. It is formatting, not data:
 * folding it into the read would store the same numbers once per language and
 * let two readers hold different snapshots. Same rule Phase E's cache key will
 * inherit — there is a test for it.
 */

export type StatsLocale = "en" | "es";

export const STATS_LOCALES: readonly StatsLocale[] = ["en", "es"] as const;
export const DEFAULT_STATS_LOCALE: StatsLocale = "en";

function isLocale(v: string): v is StatsLocale {
  return (STATS_LOCALES as readonly string[]).includes(v);
}

/**
 * Pick the language.
 *
 * An explicit `?locale=` wins — it is how someone shares the page in a specific
 * language, and how the future redirects from Learn/Play will carry the reader's
 * choice across. An unknown value falls through to the header rather than
 * erroring: a bad query param should never be able to blank a public page.
 */
export function resolveStatsLocale(
  override: string | string[] | undefined,
  acceptLanguage: string | null,
): StatsLocale {
  const raw = (Array.isArray(override) ? override[0] : override)?.toLowerCase();
  if (raw && isLocale(raw)) return raw;

  // `es-419,es;q=0.9,en;q=0.8` → the first tag we actually serve, in the
  // browser's own order of preference. Quality values are respected by reading
  // left to right, which is the order Accept-Language is already sorted in.
  for (const part of (acceptLanguage ?? "").split(",")) {
    const tag = part.trim().split(";")[0].toLowerCase();
    const base = tag.split("-")[0];
    if (isLocale(base)) return base;
  }

  return DEFAULT_STATS_LOCALE;
}
