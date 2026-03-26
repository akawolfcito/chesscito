"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Star, Timer } from "lucide-react";
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
      {/* Zone A: Hero Selector — centered piece + mission target */}
      <div className="shrink-0 px-4 pt-[max(env(safe-area-inset-top),12px)]">
        {/* Piece selector row — centered */}
        <div className="flex items-center justify-center gap-2">
          {pieces.map((piece) => {
            const isActive = selectedPiece === piece.key;
            const icon = PIECE_ICONS[piece.key as keyof typeof PIECE_ICONS];
            return (
              <button
                key={piece.key}
                type="button"
                disabled={!piece.enabled}
                onClick={() => onSelectPiece(piece.key)}
                className={`relative flex flex-col items-center justify-center rounded-full transition-all ${
                  isActive
                    ? "h-16 w-16 border-2 border-cyan-400/45 bg-cyan-500/[0.12] shadow-[0_0_16px_rgba(34,211,238,0.20)]"
                    : "h-9 w-9 border border-white/[0.06] opacity-30 disabled:opacity-20"
                }`}
                aria-label={piece.label}
              >
                <span className={isActive ? "text-2xl drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" : "text-lg"}>
                  {icon}
                </span>
                {isActive && (
                  <span className="text-[7px] font-bold uppercase tracking-[0.12em] text-cyan-200">
                    {piece.label}
                  </span>
                )}
                {!piece.enabled && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-white/10 bg-slate-600/80 text-[7px]">
                    &#128274;
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Mission label slot — target OR tutorial (mutually exclusive) */}
        <div className="mt-2 text-center">
          {pieceHint ? (
            <p className="text-[11px] font-medium text-cyan-200/50">{pieceHint}</p>
          ) : (
            <>
              <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-cyan-400/35">
                Move to
              </p>
              <p className="text-lg font-extrabold text-cyan-400/90 drop-shadow-[0_0_12px_rgba(34,211,238,0.20)]">
                {targetLabel}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Zone A2: Utility Band — Lv + stars + more */}
      <div className="flex shrink-0 items-center justify-between px-4 h-7">
        <span className="text-[11px] font-bold text-purple-400/50">
          Lv {level}
        </span>
        <div className="flex items-center gap-1.5">
          {exerciseDrawer}
          {moreAction}
        </div>
      </div>

      {/* Zone B: Board Stage — flex-1, maximum space */}
      <div className="min-h-0 flex-1 px-1 mt-2">
        {board}
        {isReplay && (
          <p className="px-2 py-1 text-center text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-cyan-400/50">
            {PRACTICE_COPY.label}
          </p>
        )}
      </div>

      {/* Zone C: Footer — micro-stats + CTA merged, then dock */}
      <div className="chesscito-footer shrink-0">
        {/* Layer 1: Micro-stats + CTA (merged) */}
        <div className="flex items-center justify-center gap-4 pt-2 pb-1.5">
          <span className="flex items-center gap-1 text-[10px] font-semibold text-white/35">
            <Star size={12} className="opacity-25" />
            {score}
          </span>
          <span className="text-[10px] text-white/15">&middot;</span>
          <span className="flex items-center gap-1 text-[10px] font-semibold text-white/35">
            <Timer size={12} className="opacity-25" />
            {Number(timeMs) / 1000}s
          </span>
        </div>
        <div className="px-3 pb-1.5">
          {contextualAction}
        </div>

        {/* Layer 2: Dock (navigation) */}
        {persistentDock}
      </div>

      {/* Fullscreen phase flash — auto-fades */}
      <PhaseFlash phase={phase} />
    </section>
  );
}
