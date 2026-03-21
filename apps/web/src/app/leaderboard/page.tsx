import { AppShell } from "@/components/app-shell";
import { CTA_LABELS, LEADERBOARD_COPY, PASSPORT_COPY } from "@/lib/content/editorial";
import { fetchLeaderboard } from "@/lib/server/leaderboard";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export default async function LeaderboardPage() {
  const rows = await fetchLeaderboard().catch(() => []);

  return (
    <AppShell
      eyebrow="Leaderboard"
      title="Top 10"
      description={LEADERBOARD_COPY.description}
      cta={{ href: "/", label: CTA_LABELS.backToPlay }}
      secondaryCta={{ href: "/", label: CTA_LABELS.startTrial }}
    >
      <p className="mb-4 text-center text-xs text-slate-500">
        {PASSPORT_COPY.infoBanner}{" "}
        <a
          href={PASSPORT_COPY.passportUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline text-primary hover:text-primary/80"
        >
          {PASSPORT_COPY.ctaLabel}
        </a>
      </p>
      <div className="space-y-3">
        {rows.length === 0 && (
          <p className="text-center text-sm text-slate-500">{LEADERBOARD_COPY.empty}</p>
        )}
        {rows.map((row) => (
          <div
            key={row.rank}
            className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border border-slate-200 px-4 py-4"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
              {row.rank}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-950">
                {row.player}
                {row.isVerified && (
                  <span className="ml-1.5 text-emerald-600" title={PASSPORT_COPY.verifiedLabel}>
                    ✓
                  </span>
                )}
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold text-slate-950">{row.score}</p>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">score</p>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
