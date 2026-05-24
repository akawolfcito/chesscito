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
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://chesscito.com";

/** Static, indexable paths under each `/{locale}/...` segment. Order
 *  drives sitemap rank — high-traffic routes first. */
const STATIC_PATHS = [
  "", // locale root → /en, /es
  "/hub",
  "/exercises",
  "/arena",
  "/trophies",
  "/coach/history",
  "/why",
  "/about",
  "/support",
  "/privacy",
  "/terms",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  // Landing route ("/") served by the root-level page; locale-prefixed
  // variants are first-class siblings so we list each path × locale.
  const entries: MetadataRoute.Sitemap = [];

  // Naked "/" landing — redirects via middleware to the user's best
  // locale; still indexable as a canonical entry point.
  entries.push({
    url: BASE_URL,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 1,
    alternates: {
      languages: Object.fromEntries(
        routing.locales.map((locale) => [locale, `${BASE_URL}/${locale}`]),
      ),
    },
  });

  for (const path of STATIC_PATHS) {
    const alternates = Object.fromEntries(
      routing.locales.map((locale) => [locale, `${BASE_URL}/${locale}${path}`]),
    );
    for (const locale of routing.locales) {
      entries.push({
        url: `${BASE_URL}/${locale}${path}`,
        lastModified: now,
        changeFrequency: path === "" ? "weekly" : "monthly",
        priority: path === "" ? 0.9 : 0.7,
        alternates: { languages: alternates },
      });
    }
  }

  return entries;
}
