"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Star, Timer, Crosshair } from "lucide-react";
import { PHASE_FLASH_COPY, PIECE_ICONS, PRACTICE_COPY } from "@/lib/content/editorial";

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
  exerciseDrawer: ReactNode;
  isReplay: boolean;
  contextualAction: ReactNode;
  persistentDock: ReactNode;
  pieceHint?: string;
  moreAction?: ReactNode;
};

type FlashConfig = { text: string; accent: string };

const PHASE_FLASH: Record<MissionPanelProps["phase"], FlashConfig | null> = {
  ready: null,
  success: { text: PHASE_FLASH_COPY.success, accent: "text-emerald-300" },
  failure: { text: PHASE_FLASH_COPY.failure, accent: "text-rose-300" },
};

function PhaseFlash({ phase }: { phase: MissionPanelProps["phase"] }) {
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

    const fadeTimer = setTimeout(() => setFading(true), 700);
    const hideTimer = setTimeout(() => setVisible(false), 1100);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, [phase, flash]);

  if (!visible || !flash) return null;

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/60 transition-opacity duration-400 ${fading ? "opacity-0" : "opacity-100"}`}
    >
      <div className="flex flex-col items-center gap-4 animate-in zoom-in-90 duration-300">
        <picture>
          <source srcSet="/art/favicon-wolf.webp" type="image/webp" />
          <img
            src="/art/favicon-wolf.png"
            alt=""
            aria-hidden="true"
            className="h-20 w-20 drop-shadow-[0_0_20px_rgba(103,232,249,0.5)]"
          />
        </picture>
        <span className={`fantasy-title text-3xl drop-shadow-lg ${flash.accent}`}>
          {flash.text}
        </span>
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
  exerciseDrawer,
  isReplay,
  contextualAction,
  persistentDock,
  pieceHint,
  moreAction,
}: MissionPanelProps) {
  return (
    <section className="mission-shell flex h-[100dvh] flex-col overflow-hidden">
      {/* Zone 1: Floating HUD — piece selector + utilities */}
      <div className="shrink-0 px-3 pt-2 pb-1">
        <div className="hud-bar flex items-center justify-between">
          {/* Piece selector — icon-only tabs for maximum breathing room */}
          <div className="flex items-center">
            {pieces.map((piece) => (
              <button
                key={piece.key}
                type="button"
                disabled={!piece.enabled}
                onClick={() => onSelectPiece(piece.key)}
                className={`relative flex h-11 w-11 items-center justify-center text-lg transition-all disabled:opacity-30 ${
                  selectedPiece === piece.key
                    ? "text-cyan-50 scale-110"
                    : "text-cyan-200/40 hover:text-cyan-200/70"
                }`}
                aria-label={piece.label}
                title={piece.label}
              >
                {PIECE_ICONS[piece.key as keyof typeof PIECE_ICONS]}
                {selectedPiece === piece.key ? (
                  <span className="absolute bottom-1 left-1/2 h-[3px] w-5 -translate-x-1/2 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(103,232,249,0.7)]" />
                ) : null}
              </button>
            ))}
          </div>

          {/* Right cluster — level, progress, more */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-cyan-300/40 tracking-widest uppercase">
              Lv{level}
            </span>
            {exerciseDrawer}
            {moreAction}
          </div>
        </div>
      </div>

      {/* Zone 2: Board Stage — hero, fills all remaining space */}
      <div className="min-h-0 flex-1 px-1">
        {pieceHint ? <p className="piece-hint">{pieceHint}</p> : null}
        {board}
        {/* Progress bar flush below board */}
        {isReplay ? (
          <p className="px-2 py-1 text-center text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-cyan-400/50">
            {PRACTICE_COPY.label}
          </p>
        ) : null}
      </div>

      {/* Zone 3: Footer — HUD strip + contextual action + persistent dock */}
      <div className="chesscito-footer shrink-0">
        {/* Layer 1: HUD strip (non-interactive) */}
        <div className="chesscito-hud-strip">
          <div className="chesscito-hud-item">
            <Star className="chesscito-hud-icon" size={14} />
            <span className="chesscito-hud-value">{score}</span>
          </div>
          <div className="chesscito-hud-divider" />
          <div className="chesscito-hud-item">
            <Timer className="chesscito-hud-icon" size={14} />
            <span className="chesscito-hud-value">{Number(timeMs) / 1000}s</span>
          </div>
          <div className="chesscito-hud-divider" />
          <div className="chesscito-hud-item">
            <Crosshair className="chesscito-hud-icon" size={14} />
            <span className="chesscito-hud-value chesscito-hud-target">{targetLabel}</span>
          </div>
        </div>

        {/* Layer 2: Contextual action slot (1 CTA at a time) */}
        {contextualAction}

        {/* Layer 3: Persistent dock (navigation) */}
        {persistentDock}
      </div>

      {/* Fullscreen phase flash — auto-fades */}
      <PhaseFlash phase={phase} />
    </section>
  );
}
