import type { ReactNode } from "react";

type PieceOption = {
  key: "rook" | "bishop" | "knight";
  label: string;
  enabled: boolean;
};

type MissionPanelProps = {
  selectedPiece: PieceOption["key"];
  onSelectPiece: (piece: PieceOption["key"]) => void;
  pieces: readonly PieceOption[];
  phase: "ready" | "success" | "failure";
  showRewardMoment: boolean;
  levelIdLabel: string;
  claimState: "idle" | "pending" | "done";
  submitState: "idle" | "pending" | "done";
  onDismissReward: () => void;
  board: ReactNode;
};

export function MissionPanel({
  selectedPiece,
  onSelectPiece,
  pieces,
  phase,
  showRewardMoment,
  levelIdLabel,
  claimState,
  submitState,
  onDismissReward,
  board,
}: MissionPanelProps) {
  return (
    <section className="mission-card mission-shell stage-vignette space-y-4 rounded-3xl p-4">
      <div className="space-y-2">
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
          <span className="glow-dot" />
          Arcane Play Hub
        </p>
        <h1 className="fantasy-title text-3xl font-semibold tracking-tight text-cyan-50">Realm Tactics Console</h1>
        <p className="text-sm text-slate-300">
          Completa la misión, reclama badge y registra score on-chain sin salir del tablero.
        </p>
      </div>

      <div className="flex gap-2">
        {pieces.map((piece) => (
          <button
            key={piece.key}
            type="button"
            disabled={!piece.enabled}
            onClick={() => onSelectPiece(piece.key)}
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${
              selectedPiece === piece.key
                ? "bg-cyan-300 text-slate-900 shadow-[0_0_20px_rgba(103,232,249,0.45)]"
                : "mission-chip disabled:opacity-50"
            }`}
          >
            {piece.label}
          </button>
        ))}
      </div>

      <div className="mission-soft rune-frame rounded-2xl p-3 text-sm">
        Objetivo: capturar <span className="font-semibold">h1</span> en un movimiento.
      </div>

      <div className="relative">
        {board}
        {showRewardMoment ? (
          <div className="reward-burst absolute inset-3 z-30 flex items-center justify-center rounded-2xl border border-cyan-300/45 bg-slate-950/82 p-4 backdrop-blur">
            <div className="w-full max-w-xs space-y-3 rounded-2xl border border-cyan-300/40 bg-cyan-900/35 p-4 text-cyan-50 shadow-[0_0_40px_rgba(34,211,238,0.35)]">
              <p className="text-center text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
                Mission Clear
              </p>
              <h3 className="fantasy-title text-center text-2xl font-semibold">Rook Trial Complete</h3>
              <p className="text-center text-xs text-cyan-100/80">Nivel activo: {levelIdLabel}</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rune-frame rounded-xl bg-slate-900/60 px-2 py-2 text-center">
                  <p className="text-cyan-200">Claim</p>
                  <p className="mt-1 font-semibold">
                    {claimState === "done" ? "Done" : claimState === "pending" ? "Pending" : "Ready"}
                  </p>
                </div>
                <div className="rune-frame rounded-xl bg-slate-900/60 px-2 py-2 text-center">
                  <p className="text-cyan-200">Submit</p>
                  <p className="mt-1 font-semibold">
                    {submitState === "done" ? "Done" : submitState === "pending" ? "Pending" : "Ready"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onDismissReward}
                className="w-full rounded-xl border border-cyan-300/45 bg-cyan-300/15 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100 hover:bg-cyan-300/25"
              >
                Continue
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {phase === "failure" ? (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-900/35 px-4 py-3 text-sm text-rose-200">
          Jugada incorrecta. Reinicia para intentar de nuevo.
        </div>
      ) : null}
      {phase === "ready" ? (
        <div className="rounded-2xl border border-cyan-500/35 bg-cyan-900/25 px-4 py-3 text-sm text-cyan-100">
          Haz una sola jugada valida para capturar la pieza objetivo en <span className="font-semibold">h1</span>.
        </div>
      ) : null}
      {phase === "success" ? (
        <div className="rounded-2xl border border-emerald-400/45 bg-emerald-900/35 px-4 py-3 text-sm text-emerald-100">
          Objetivo completado. Ya puedes claim badge y submit score.
        </div>
      ) : null}
    </section>
  );
}
