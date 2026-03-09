import { AppShell } from "@/components/app-shell";
import { CTA_LABELS } from "@/lib/content/editorial";
import { fetchLeaderboard } from "@/lib/server/leaderboard";

export const revalidate = 60;

export default async function LeaderboardPage() {
  const rows = await fetchLeaderboard().catch(() => []);

  return (
    <AppShell
      eyebrow="Leaderboard"
      title="Top 10"
      description="Los mejores scores registrados on-chain."
      cta={{ href: "/play-hub", label: CTA_LABELS.backToPlay }}
      secondaryCta={{ href: "/", label: CTA_LABELS.startTrial }}
    >
      <div className="space-y-3">
        {rows.length === 0 && (
          <p className="text-center text-sm text-slate-500">Aún no hay scores registrados.</p>
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
              <p className="text-sm font-semibold text-slate-950">{row.player}</p>
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
