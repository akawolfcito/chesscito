import { AppShell } from "@/components/app-shell";

const rows = [
  { rank: 1, player: "0x71...2d4c", score: 980, time: "18.4s" },
  { rank: 2, player: "0x8a...96bb", score: 910, time: "20.1s" },
  { rank: 3, player: "0x0f...cc31", score: 860, time: "22.7s" },
];

export default function LeaderboardPage() {
  return (
    <AppShell
      eyebrow="Leaderboard"
      title="Top 10"
      description="Aqui se conectara el endpoint que leerá eventos on-chain. Por ahora dejamos la ruta y la estructura movil."
      cta={{ href: "/levels", label: "Volver a jugar" }}
      secondaryCta={{ href: "/result", label: "Ver resultado" }}
    >
      <div className="space-y-3">
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
              <p className="text-sm text-slate-500">Tiempo {row.time}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold text-slate-950">{row.score}</p>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">pts</p>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
