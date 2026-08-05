import type { Metadata } from "next";
import { headers } from "next/headers";

import { StatsDashboard } from "@/components/stats/stats-dashboard";
import { parseStatsFilters } from "@/lib/stats/filters";
import { resolveStatsLocale, STATS_LOCALES, type StatsLocale } from "@/lib/stats/locale";
import { EMPTY_PLAYERS_CENSUS } from "@/lib/stats/players-census";
import {
  loadPlayersCensus,
  loadStatsSnapshot,
  STATS_REVALIDATE_SECONDS,
} from "@/lib/stats/snapshot";
import { EMPTY_PUBLIC_STATS } from "@/lib/stats/types";

/**
 * The consolidated public `/stats` dashboard.
 *
 * ⛔ **Reachable is not the same as indexable.** This page is a deliverable of
 * the MiniPay listing (§8) — it must be public, with no wallet and no auth — and
 * it must also stay out of search results. `noindex, nofollow` plus absence
 * from the sitemap is what reconciles those two, and gating it would break the
 * listing. See `docs/specs/2026-07-30-stats-paid-export-x402.md` §0.
 *
 * `follow: false` is load-bearing: the landing IS indexed and links here, so a
 * crawler arrives through that link. Without it, it would then follow the
 * outbound links onward.
 *
 * ⛔ **One URL.** `/stats` stays outside the next-intl middleware matcher, so
 * there is no `/en/stats` and no `/es/stats`: two indexable URLs for the same
 * content is one more than the listing can declare. Language comes from
 * `Accept-Language`, overridable with `?locale=en|es`.
 */
export const metadata: Metadata = {
  title: "Stats — Chesscito",
  description: "Activity and progress stats for Chesscito Learn and Chesscito Play.",
  alternates: { canonical: "https://www.chesscito.com/stats" },
  robots: { index: false, follow: false },
};

/**
 * ⚠️ The page itself stays dynamic. The CACHE lives one layer down, on the
 * snapshot (`lib/stats/snapshot.ts`), keyed by `surface`/`container` and
 * tagged `"public-stats"`.
 *
 * That split is deliberate: the render depends on `Accept-Language`, and a
 * route-level `revalidate` would have to key on the header too — which would
 * store the same numbers once per language and let two readers hold different
 * snapshots of the same moment. Caching the DATA and re-rendering the HTML
 * costs a few milliseconds and keeps one photo behind both languages.
 */
export const dynamic = "force-dynamic";

type SearchParams = {
  surface?: string | string[];
  container?: string | string[];
  locale?: string | string[];
};

export default async function StatsPage({
  searchParams = {},
}: {
  searchParams?: SearchParams;
}) {
  // ⚠️ `locale` is deliberately NOT part of the filters. It is presentation:
  // folding it into the read would fetch the same numbers once per language,
  // and Phase E's cache key inherits this separation. There is a test for it.
  const filters = parseStatsFilters(searchParams);

  const rawLocale = Array.isArray(searchParams.locale)
    ? searchParams.locale[0]
    : searchParams.locale;
  const localeOverride: StatsLocale | null =
    rawLocale && (STATS_LOCALES as readonly string[]).includes(rawLocale.toLowerCase())
      ? (rawLocale.toLowerCase() as StatsLocale)
      : null;

  const locale = resolveStatsLocale(
    searchParams.locale,
    headers().get("accept-language"),
  );

  // `allSettled` so a thrown read cannot blank a public page. The aggregator
  // already swallows its own failures; this is the belt for the census, which
  // reaches a different relation.
  // Two cache entries, two clocks: the snapshot is keyed by the filters, the
  // census is global and stamps its own `asOf`. `allSettled` so a throw in
  // either loader cannot blank a public page.
  const [snapshotResult, censusResult] = await Promise.allSettled([
    loadStatsSnapshot(filters),
    loadPlayersCensus(),
  ]);

  const snapshot =
    snapshotResult.status === "fulfilled"
      ? snapshotResult.value
      : {
          stats: { ...EMPTY_PUBLIC_STATS, filters, generatedAt: new Date().toISOString() },
          breakdown: { learn: null, play: null, total: null },
        };
  const census =
    censusResult.status === "fulfilled" ? censusResult.value : EMPTY_PLAYERS_CENSUS;

  return (
    <StatsDashboard
      stats={snapshot.stats}
      breakdown={snapshot.breakdown}
      census={census}
      locale={locale}
      localeOverride={localeOverride}
    />
  );
}
