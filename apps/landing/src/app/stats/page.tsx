import type { Metadata } from "next";
import { headers } from "next/headers";

import { StatsDashboard } from "@/components/stats/stats-dashboard";
import { getPublicStats, getSurfaceBreakdown } from "@/lib/stats/aggregator";
import { parseStatsFilters } from "@/lib/stats/filters";
import { resolveStatsLocale, STATS_LOCALES, type StatsLocale } from "@/lib/stats/locale";
import { EMPTY_PLAYERS_CENSUS, readPlayersCensus } from "@/lib/stats/players-census";

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
 * ⚠️ NO caching in this phase — no `revalidate`, no `unstable_cache`, no tag.
 * The aggregator is uncached by design (Phase C policy) and every request runs
 * the eight RPCs. Phase E adds the cache at this level, where its TTL and its
 * invalidation are visible; until then this page must not be published to
 * traffic.
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
  const [statsResult, breakdownResult, censusResult] = await Promise.allSettled([
    getPublicStats(filters),
    getSurfaceBreakdown(filters.container),
    readPlayersCensus(),
  ]);

  const stats =
    statsResult.status === "fulfilled"
      ? statsResult.value
      : await getPublicStats(filters);
  const breakdown =
    breakdownResult.status === "fulfilled"
      ? breakdownResult.value
      : { learn: null, play: null, total: null };
  const census =
    censusResult.status === "fulfilled" ? censusResult.value : EMPTY_PLAYERS_CENSUS;

  return (
    <StatsDashboard
      stats={stats}
      breakdown={breakdown}
      census={census}
      locale={locale}
      localeOverride={localeOverride}
    />
  );
}
