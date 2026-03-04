import { ResultActions } from "@/app/result/result-actions";
import { AppShell } from "@/components/app-shell";

type ResultPageProps = {
  searchParams?: {
    piece?: string;
    score?: string;
    status?: string;
    target?: string;
    moves?: string;
  };
};

export default function ResultPage({ searchParams }: ResultPageProps) {
  const piece = searchParams?.piece ?? "rook";
  const score = searchParams?.score ?? "000";
  const status = searchParams?.status ?? "pending";
  const target = searchParams?.target ?? "n/a";
  const moves = searchParams?.moves ?? "0";

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
          <p className="mt-2 text-lg font-semibold">{piece === "rook" ? "Torre" : piece}</p>
        </div>
        <div className="rounded-2xl bg-slate-100 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Score</p>
          <p className="mt-2 text-lg font-semibold text-slate-950">{score}</p>
        </div>
        <div className="rounded-2xl bg-slate-100 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Badge</p>
          <p className="mt-2 text-lg font-semibold text-slate-950">Pendiente</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-slate-100 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Status</p>
          <p className="mt-2 text-lg font-semibold capitalize text-slate-950">{status}</p>
        </div>
        <div className="rounded-2xl bg-slate-100 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Objetivo</p>
          <p className="mt-2 text-lg font-semibold text-slate-950">
            {target} en {moves} movimiento
          </p>
        </div>
      </div>
      <ResultActions piece={piece} score={score} moves={moves} status={status} />
    </AppShell>
  );
}
