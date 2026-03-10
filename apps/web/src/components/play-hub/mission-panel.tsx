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
  starsBar: ReactNode;
  actionPanel: ReactNode;
};

const SELECTED_PIECE_ART: Record<PieceOption["key"], string> = {
  rook: "/art/torre-selected.webp",
  bishop: "/art/alfil-selected.webp",
  knight: "/art/caballo-selected.webp",
};

const PHASE_TOAST: Record<MissionPanelProps["phase"], { text: string; bg: string } | null> = {
  ready: null,
  success: { text: "Well done!", bg: "bg-emerald-900/70 ring-emerald-400/40" },
  failure: { text: "Try again", bg: "bg-rose-900/60 ring-rose-400/40" },
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
  starsBar,
  actionPanel,
}: MissionPanelProps) {
  const toast = PHASE_TOAST[phase];

  return (
    <section className="mission-shell flex h-[100dvh] flex-col overflow-hidden px-3 pb-3 pt-2">
      {/* Top row: piece selector + phase badge */}
      <div className="flex shrink-0 items-center gap-2 pb-2">
        {pieces.map((piece) => (
          <button
            key={piece.key}
            type="button"
            disabled={!piece.enabled}
            onClick={() => onSelectPiece(piece.key)}
            className={`relative h-9 min-w-[72px] shrink overflow-hidden rounded-full px-3 text-xs font-semibold uppercase tracking-[0.2em] transition disabled:opacity-40 ${
              selectedPiece === piece.key
                ? "text-cyan-50 shadow-[0_0_20px_rgba(103,232,249,0.45)]"
                : "mission-chip"
            }`}
            style={
              selectedPiece === piece.key
                ? {
                    backgroundImage: `linear-gradient(180deg, rgba(2,6,23,0.42), rgba(2,6,23,0.42)), url("${SELECTED_PIECE_ART[piece.key]}")`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }
                : undefined
            }
          >
            {piece.label}
          </button>
        ))}

        <span className="ml-auto shrink-0 whitespace-nowrap text-xs text-cyan-300/80 tracking-[0.16em] uppercase">
          Lv {level}
        </span>
      </div>

      {/* Board — fills remaining space */}
      <div className="min-h-0 flex-1">{board}</div>

      {/* Phase feedback toast with wolf mascot */}
      <div className="relative mt-2 flex h-8 shrink-0 items-center justify-center">
        {toast ? (
          <div className={`flex items-center gap-2 rounded-full px-4 py-1.5 ring-1 animate-in fade-in zoom-in-95 duration-300 ${toast.bg}`}>
            <img
              src="/art/favicon-wolf.png"
              alt=""
              aria-hidden="true"
              className="h-5 w-5 rounded-full"
            />
            <span className="text-xs font-semibold text-white">{toast.text}</span>
          </div>
        ) : null}
      </div>

      {/* Exercise stars */}
      <div className="shrink-0">{starsBar}</div>

      {/* Stats bar */}
      <div className="chesscito-stats-bar mt-2 shrink-0">
        <div className="chesscito-stats-item">
          <span className="chesscito-stats-label">SCORE</span>
          <span className="chesscito-stats-value">{score}</span>
        </div>
        <div className="chesscito-stats-item">
          <span className="chesscito-stats-label">TIME</span>
          <span className="chesscito-stats-value">{Number(timeMs) / 1000}s</span>
        </div>
        <div className="chesscito-stats-item">
          <span className="chesscito-stats-label">TARGET</span>
          <span className="chesscito-stats-value">h1</span>
        </div>
      </div>

      {/* Action panel */}
      <div className="mt-2 shrink-0">{actionPanel}</div>
    </section>
  );
}
