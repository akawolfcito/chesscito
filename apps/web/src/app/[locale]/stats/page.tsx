import { unstable_cache } from "next/cache";
import { getTranslations } from "next-intl/server";
import { StatsPage } from "@/components/stats/stats-page";
import { getPublicStats } from "@/lib/stats/public-aggregator";
import { parseStatsFilters, type StatsFilters } from "@/lib/stats/filters";
import {
  nicknameTokensFromTranslator,
  type NicknameTranslator,
} from "@/lib/identity/nickname-tokens";

export const metadata = {
  title: "Platform Stats — Chesscito",
  description:
    "Public activity metrics for Chesscito on Celo — sessions, " +
    "focus training, progress saves, and MiniPay usage.",
  // Reachable, not indexable. MiniPay's listing requirements (§8) ask for a
  // stats page any reviewer can open without a wallet, so the route stays
  // open — but the numbers on it describe the business, and search results
  // are not where they belong. `follow: false` also stops the crawler from
  // walking onward through the links on the page.
  robots: { index: false, follow: false },
};

// Snapshot refreshed by Next.js every hour. Falls back to stale data
// rather than blocking when the underlying queries are slow; downstream
// aggregator returns null per-field for any query that fails, so the
// page never 500s on partial Supabase outages.
export const revalidate = 3600;

// Per-filter-combination hourly cache. Reading searchParams makes the route
// dynamic, but the Supabase aggregation still caches for an hour keyed by the
// (surface, container) pair, so each querystring gets its own correct,
// independently-revalidated snapshot instead of re-querying every request.
function loadStats(filters: StatsFilters) {
  return unstable_cache(
    () => getPublicStats(filters),
    ["public-stats", filters.surface, filters.container],
    { revalidate: 3600, tags: ["public-stats"] },
  )();
}

export default async function StatsRoute({
  searchParams,
}: {
  searchParams: { surface?: string; container?: string };
}) {
  const filters = parseStatsFilters(searchParams);
  const stats = await loadStats(filters);
  // Build the locale-aware nickname tokens server-side (the aggregator is
  // locale-agnostic + cached); StatsPage formats names from the row variants.
  const tIdentity = await getTranslations("IDENTITY_COPY");
  const nicknameTokens = nicknameTokensFromTranslator(
    tIdentity as unknown as NicknameTranslator,
  );

  // Dropped LegalPageShell (locked to var(--app-max-width) = 390px) in
  // favor of a landing-aligned full-width shell. /stats is a public
  // platform dashboard, not an in-app sheet — it deserves to breathe
  // on desktop and look like the landing footer / about page family
  // rather than a player-profile card.
  //
  // `stats-page-scrim` overrides the default dark `secondary-page-scrim`
  // with a cream/amber wash so the forest body bg stays visible (brand
  // continuity) but stops competing with the dashboard content.
  return (
    <main
      className="mission-shell stats-page-scrim min-h-[100dvh] w-full"
      style={{ color: "var(--paper-text)" }}
    >
      <div className="mx-auto w-full max-w-[1200px] px-5 py-8 md:px-10 md:py-12">
        <StatsPage stats={stats} nicknameTokens={nicknameTokens} />
      </div>
    </main>
  );
}
