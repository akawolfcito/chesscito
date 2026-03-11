"use client";

import { useEffect, useState } from "react";
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
  targetLabel: string;
  score: string;
  timeMs: string;
  level: string;
  board: ReactNode;
  starsBar: ReactNode;
  actionPanel: ReactNode;
  pieceHint?: string;
  shieldCount?: number;
  onUseShield?: () => void;
};

type FlashConfig = { text: string; accent: string };

const PHASE_FLASH: Record<MissionPanelProps["phase"], FlashConfig | null> = {
  ready: null,
  success: { text: "Well done!", accent: "text-emerald-300" },
  failure: { text: "Try again", accent: "text-rose-300" },
};

function PhaseFlash({
  phase,
  shieldCount = 0,
  onUseShield,
}: {
  phase: MissionPanelProps["phase"];
  shieldCount?: number;
  onUseShield?: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const flash = PHASE_FLASH[phase];

  useEffect(() => {
    if (!flash) {
      setVisible(false);
      setFading(false);
      return;
    }

    setVisible(true);
    setFading(false);

    const hasShield = phase === "failure" && shieldCount > 0;
    const fadeDelay = hasShield ? 2600 : 700;
    const hideDelay = hasShield ? 3000 : 1100;

    const fadeTimer = setTimeout(() => setFading(true), fadeDelay);
    const hideTimer = setTimeout(() => setVisible(false), hideDelay);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, [phase, flash, shieldCount]);

  if (!visible || !flash) return null;

  const hasShield = phase === "failure" && shieldCount > 0;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 transition-opacity duration-[400ms] ${
        hasShield ? "" : "pointer-events-none"
      } ${fading ? "opacity-0" : "opacity-100"}`}
    >
      <div className="flex flex-col items-center gap-4 animate-in zoom-in-90 duration-300">
        <img
          src="/art/favicon-wolf.png"
          alt=""
          aria-hidden="true"
          className="h-20 w-20 drop-shadow-[0_0_20px_rgba(103,232,249,0.5)]"
        />
        <span className={`fantasy-title text-3xl drop-shadow-lg ${flash.accent}`}>
          {flash.text}
        </span>
        {hasShield && onUseShield ? (
          <button
            type="button"
            onClick={() => {
              setVisible(false);
              onUseShield();
            }}
            className="mt-2 rounded-xl bg-amber-500/90 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-amber-400 active:scale-95"
          >
            Use Shield ({shieldCount} left)
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function MissionPanel({
  selectedPiece,
  onSelectPiece,
  pieces,
  phase,
  targetLabel,
  score,
  timeMs,
  level,
  board,
  starsBar,
  actionPanel,
  pieceHint,
  shieldCount,
  onUseShield,
}: MissionPanelProps) {
  return (
    <section className="mission-shell flex h-[100dvh] flex-col overflow-hidden">
      {/* Zone 1: Floating HUD — piece selector + level */}
      <div className="shrink-0 px-3 pt-2 pb-1">
        <div className="hud-bar flex items-center gap-1">
          {pieces.map((piece) => (
            <button
              key={piece.key}
              type="button"
              disabled={!piece.enabled}
              onClick={() => onSelectPiece(piece.key)}
              className={`relative h-11 px-3 text-xs font-semibold uppercase tracking-[0.16em] transition disabled:opacity-40 ${
                selectedPiece === piece.key
                  ? "text-cyan-50"
                  : "text-cyan-200/50"
              }`}
            >
              {piece.label}
              {selectedPiece === piece.key ? (
                <span className="absolute bottom-0 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(103,232,249,0.6)]" />
              ) : null}
            </button>
          ))}
          <span className="ml-auto shrink-0 text-xs text-cyan-300/70 tracking-[0.14em] uppercase">
            Lv {level}
          </span>
        </div>
      </div>

      {/* Zone 2: Board Stage — hero, fills all remaining space */}
      <div className="min-h-0 flex-1 px-1">
        {pieceHint ? <p className="piece-hint">{pieceHint}</p> : null}
        {board}
        {/* Progress bar flush below board */}
        <div className="px-2">{starsBar}</div>
      </div>

      {/* Zone 3: Bottom Dock — stats + actions */}
      <div className="chesscito-dock shrink-0">
        {/* Stats row */}
        <div className="chesscito-stats-bar mb-2">
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
            <span className="chesscito-stats-value">{targetLabel}</span>
          </div>
        </div>

        {/* Action buttons */}
        {actionPanel}
      </div>

      {/* Fullscreen phase flash — auto-fades */}
      <PhaseFlash phase={phase} shieldCount={shieldCount} onUseShield={onUseShield} />
    </section>
  );
}
