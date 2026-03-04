import { AppShell } from "@/components/app-shell";

export default function ResultPage() {
  return (
    <AppShell
      eyebrow="Result"
      title="Resultado local"
      description="Este placeholder reserva el espacio para score, tiempo, CTA on-chain y badge state. Aun no hay integracion con contratos."
      cta={{ href: "/leaderboard", label: "Ir al leaderboard" }}
      secondaryCta={{ href: "/levels", label: "Jugar de nuevo" }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-slate-950 px-4 py-4 text-white">
          <p className="text-xs uppercase tracking-[0.2em] text-white/60">Pieza</p>
          <p className="mt-2 text-lg font-semibold">Torre</p>
        </div>
        <div className="rounded-2xl bg-slate-100 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Score</p>
          <p className="mt-2 text-lg font-semibold text-slate-950">000</p>
        </div>
        <div className="rounded-2xl bg-slate-100 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Badge</p>
          <p className="mt-2 text-lg font-semibold text-slate-950">Pendiente</p>
        </div>
      </div>
    </AppShell>
  );
}
