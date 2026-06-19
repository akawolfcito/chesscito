const FULL_ONLY_SEGMENTS = [
  "arena",
  "coach",
  "victory",
  "shop",
  "pro",
  "founder",
] as const;

/**
 * Strips a known locale prefix from a pathname.
 * Under "as-needed" localePrefix, the default locale (EN) has NO prefix
 * at the canonical URL, but next-intl may still receive /en/* requests
 * (external bookmarks, etc.) — strip those too.
 *
 * Returns the canonical path (always starts with /) after stripping.
 */
function stripLocalePrefix(
  pathname: string,
  locales: readonly string[],
  defaultLocale: string,
): { canonical: string; localePrefix: string } {
  for (const locale of locales) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      const localePrefix = locale === defaultLocale ? "" : `/${locale}`;
      const canonical = pathname.slice(`/${locale}`.length) || "/";
      return { canonical, localePrefix };
    }
  }
  return { canonical: pathname, localePrefix: "" };
}

/**
 * Returns true when the pathname (with or without a locale prefix)
 * resolves to a Full-only segment.
 */
export function isFullOnlyPath(
  pathname: string,
  locales: readonly string[],
  defaultLocale: string,
): boolean {
  const { canonical } = stripLocalePrefix(pathname, locales, defaultLocale);
  return FULL_ONLY_SEGMENTS.some(
    (seg) =>
      canonical === `/${seg}` || canonical.startsWith(`/${seg}/`),
  );
}

/**
 * Returns the locale-appropriate /hub target path to redirect to.
 * Examples:
 *   /arena       → /hub
 *   /es/arena    → /es/hub
 *   /en/arena    → /hub  (EN is the default locale, no prefix)
 */
export function getLiteHubTarget(
  pathname: string,
  locales: readonly string[],
  defaultLocale: string,
): string {
  const { localePrefix } = stripLocalePrefix(pathname, locales, defaultLocale);
  return `${localePrefix}/hub`;
}
