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
  score: string;
  timeMs: string;
  level: string;
  board: ReactNode;
};

export function MissionPanel({
  selectedPiece,
  onSelectPiece,
  pieces,
  phase,
  score,
  timeMs,
  level,
  board,
}: MissionPanelProps) {
  return (
    <section className="stage-vignette space-y-4 p-4">
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

      {board}

      <div className="chesscito-stats-bar">
        <div className="chesscito-stats-item">
          <span className="chesscito-stats-label">SCORE</span>
          <span className="chesscito-stats-value">{score}</span>
        </div>
        <div className="chesscito-stats-item">
          <span className="chesscito-stats-label">TIME</span>
          <span className="chesscito-stats-value">{timeMs} ms</span>
        </div>
        <div className="chesscito-stats-item">
          <span className="chesscito-stats-label">LEVEL</span>
          <span className="chesscito-stats-value">{level}</span>
        </div>
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
