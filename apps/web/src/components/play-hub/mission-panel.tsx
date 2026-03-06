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
  board: ReactNode;
};

export function MissionPanel({ selectedPiece, onSelectPiece, pieces, phase, board }: MissionPanelProps) {
  return (
    <section className="mission-card mission-shell space-y-4 rounded-3xl p-4">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">Play Hub</p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-100">Juega, compra y guarda on-chain</h1>
        <p className="text-sm text-slate-300">
          MVP de una pantalla: challenge + claim/submit + store USDC. MiniPay puede mostrar Unknown transaction.
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
                ? "bg-cyan-300 text-slate-900"
                : "mission-chip disabled:opacity-50"
            }`}
          >
            {piece.label}
          </button>
        ))}
      </div>

      <div className="mission-soft rounded-2xl p-3 text-sm">
        Objetivo: capturar <span className="font-semibold">h1</span> en un movimiento.
      </div>

      {board}

      {phase === "failure" ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Jugada incorrecta. Reinicia para intentar de nuevo.
        </div>
      ) : null}
      {phase === "ready" ? (
        <div className="rounded-2xl border border-sky-800/60 bg-sky-900/30 px-4 py-3 text-sm text-sky-200">
          Haz una sola jugada valida para capturar la pieza objetivo en <span className="font-semibold">h1</span>.
        </div>
      ) : null}
      {phase === "success" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Objetivo completado. Ya puedes claim badge y submit score.
        </div>
      ) : null}
    </section>
  );
}
