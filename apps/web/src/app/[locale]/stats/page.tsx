import { StatsPage } from "@/components/stats/stats-page";
import { getPublicStats } from "@/lib/stats/public-aggregator";

export const metadata = {
  title: "Platform Stats — Chesscito",
  description:
    "Public activity metrics for Chesscito on Celo — sessions, " +
    "mints, onboarding, and community activity.",
};

// Snapshot refreshed by Next.js every hour. Falls back to stale data
// rather than blocking when the underlying queries are slow; downstream
// aggregator returns null per-field for any query that fails, so the
// page never 500s on partial Supabase outages.
export const revalidate = 3600;

export default async function StatsRoute() {
  const stats = await getPublicStats();

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
        <StatsPage stats={stats} />
      </div>
    </main>
  );
}
