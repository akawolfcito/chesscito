import { LegalPageShell } from "@/components/legal-page-shell";
import { StatsPage } from "@/components/stats/stats-page";
import { getPublicStats } from "@/lib/stats/public-aggregator";

export const metadata = {
  title: "Stats — Chesscito",
  description:
    "Public platform statistics for Chesscito on Celo — mints, " +
    "claims, and approximate activity.",
};

// Snapshot refreshed by Next.js every hour. Falls back to stale data
// rather than blocking when the underlying queries are slow; downstream
// aggregator returns null per-field for any query that fails, so the
// page never 500s on partial Supabase outages.
export const revalidate = 3600;

export default async function StatsRoute() {
  const stats = await getPublicStats();

  return (
    <LegalPageShell title="Stats" backHref="/about">
      <StatsPage stats={stats} />
    </LegalPageShell>
  );
}
