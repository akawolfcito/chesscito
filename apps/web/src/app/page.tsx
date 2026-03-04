import { AppShell } from "@/components/app-shell";

export default function Home() {
  return (
    <AppShell
      eyebrow="MiniPay MiniApp"
      title="Chesscito"
      description="Mini-juegos pre-ajedrecisticos para bienestar cognitivo: cortos, medibles y listos para llevar prueba on-chain en Celo."
      cta={{ href: "/levels", label: "Ver niveles" }}
      secondaryCta={{ href: "/leaderboard", label: "Leaderboard" }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-slate-950 px-4 py-4 text-white">
          <p className="text-xs uppercase tracking-[0.2em] text-white/60">Focus</p>
          <p className="mt-2 text-sm leading-6 text-white/90">Tower first. Bishop and Knight later.</p>
        </div>
        <div className="rounded-2xl bg-slate-100 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Proof</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">submitScore + claimBadge live in the next slices.</p>
        </div>
        <div className="rounded-2xl bg-slate-100 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Mode</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">Mobile-first routes ready for MiniPay device testing.</p>
        </div>
      </div>
    </AppShell>
  );
}
