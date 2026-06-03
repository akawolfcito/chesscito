import type { MetadataRoute } from "next";

import { routing } from "@/i18n/routing";

/**
 * Bilingual sitemap.
 *
 * Lists every static, indexable route under each supported locale and
 * declares the cross-locale `<xhtml:link rel="alternate">` triplet so
 * Google / Bing surface the right variant per region. Dynamic routes
 * (`/victory/[id]`, `/share/*` with query) are intentionally excluded
 * — those are per-game share landings, not browse-able pages.
 *
 * Spec: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
 */
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.chesscito.com";

/** Static, indexable paths. Under `localePrefix: "as-needed"` the
 *  default locale (EN) serves at the bare path and non-default
 *  locales carry the `/<locale>/` prefix. Order drives sitemap
 *  rank — high-traffic routes first. */
const STATIC_PATHS = [
  "", // default locale root → "/", non-default → "/<locale>"
  "/hub",
  "/exercises",
  "/arena",
  "/trophies",
  "/coach/history",
  "/why",
  "/about",
  "/stats",
  "/support",
  "/privacy",
  "/terms",
] as const;

/** Canonical URL for a given locale + path under the as-needed
 *  routing model. Default locale lives at the bare path; other
 *  locales nest under `/<locale>/`. */
function urlFor(locale: string, path: string): string {
  if (locale === routing.defaultLocale) {
    return path === "" ? BASE_URL : `${BASE_URL}${path}`;
  }
  return `${BASE_URL}/${locale}${path}`;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];

  for (const path of STATIC_PATHS) {
    const alternates = Object.fromEntries(
      routing.locales.map((locale) => [locale, urlFor(locale, path)]),
    );
    for (const locale of routing.locales) {
      entries.push({
        url: urlFor(locale, path),
        lastModified: now,
        changeFrequency: path === "" ? "weekly" : "monthly",
        priority: path === "" ? 1 : 0.7,
        alternates: { languages: alternates },
      });
    }
  }

  return entries;
}
