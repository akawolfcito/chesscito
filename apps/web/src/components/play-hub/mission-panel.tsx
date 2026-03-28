"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Star, Timer } from "lucide-react";
import { MISSION_BRIEFING_COPY, PHASE_FLASH_COPY, PIECE_IMAGES, PIECE_LABELS, PRACTICE_COPY } from "@/lib/content/editorial";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import { GameplayPanel } from "@/components/play-hub/gameplay-panel";

type PieceOption = {
  key: "rook" | "bishop" | "knight" | "pawn" | "queen" | "king";
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
  board: ReactNode;
  exerciseDrawer: ReactNode;
  isReplay: boolean;
  contextualAction: ReactNode;
  persistentDock: ReactNode;
  pieceHint?: string;
  isCapture?: boolean;
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

    const fadeTimer = setTimeout(() => setFading(true), 600);
    const hideTimer = setTimeout(() => setVisible(false), 950);

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
        <div className="relative flex items-center justify-center">
          {phase === "success" && (
            <div className="pointer-events-none absolute h-40 w-40">
              <LottieAnimation src="/animations/sparkle-burst.lottie" loop={false} className="h-full w-full" />
            </div>
          )}
          <picture className="relative z-10">
            <source srcSet="/art/favicon-wolf.webp" type="image/webp" />
            <img
              src="/art/favicon-wolf.png"
              alt=""
              aria-hidden="true"
              className="h-20 w-20 drop-shadow-[0_0_20px_rgba(103,232,249,0.5)]"
            />
          </picture>
        </div>
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
  board,
  exerciseDrawer,
  isReplay,
  contextualAction,
  persistentDock,
  pieceHint,
  isCapture = false,
}: MissionPanelProps) {
  const prevPieceRef = useRef(selectedPiece);
  const [plopping, setPlopping] = useState(false);

  useEffect(() => {
    if (prevPieceRef.current !== selectedPiece) {
      prevPieceRef.current = selectedPiece;
      setPlopping(true);
      const timer = setTimeout(() => setPlopping(false), 300);
      return () => clearTimeout(timer);
    }
  }, [selectedPiece]);

  const statsContent = (
    <div className="flex items-center gap-3">
      <div className="shrink-0">{exerciseDrawer}</div>
      <span className="h-4 w-px bg-white/8" />
      <div className="flex flex-1 items-center justify-center gap-4">
        <span className="flex items-center gap-1 text-xs font-bold tabular-nums text-white/75">
          <Star size={14} className="opacity-65" />
          {score}
        </span>
        <span className="text-xs text-white/15">&middot;</span>
        <span className="flex items-center gap-1 text-xs font-bold tabular-nums text-white/75">
          <Timer size={14} className="opacity-65" />
          {Number(timeMs) / 1000}s
        </span>
      </div>
    </div>
  );

  const missionContent = (
    <div className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-cyan-400/70">
          {MISSION_BRIEFING_COPY.label}
        </p>
        <p key={targetLabel} className="mission-typewriter text-sm font-bold text-slate-100">
          {isCapture
            ? <>Move your {PIECE_LABELS[selectedPiece as keyof typeof PIECE_LABELS]} to <span className="text-rose-400">CAPTURE</span></>
            : `Move your ${PIECE_LABELS[selectedPiece as keyof typeof PIECE_LABELS]} to ${targetLabel}`}
        </p>
        <p key={`hint-${targetLabel}`} className="mission-typewriter text-[11px] text-cyan-100/40" style={{ animationDelay: "1s" }}>
          {MISSION_BRIEFING_COPY.moveHint[selectedPiece as keyof typeof MISSION_BRIEFING_COPY.moveHint]}
        </p>
      </div>
      <picture className="h-12 w-12 shrink-0">
        <source srcSet="/art/favicon-wolf.webp" type="image/webp" />
        <img src="/art/favicon-wolf.png" alt="" aria-hidden="true" className="h-full w-full object-contain drop-shadow-[0_0_8px_rgba(103,232,249,0.3)]" />
      </picture>
    </div>
  );

  return (
    <section className="mission-shell flex h-[100dvh] flex-col overflow-hidden">
      {/* Zone A: Hero Selector — rail + Lv/help controls + mission target */}
      <div className="shell-header-rail shrink-0 w-full">
        {/* Piece selector rail + utility controls side by side */}
        <div className="flex items-center gap-2">
          <div className="hero-rail flex-1 min-w-0">
            {pieces.map((piece) => {
              const isActive = selectedPiece === piece.key;
              const src = PIECE_IMAGES[piece.key as keyof typeof PIECE_IMAGES];
              return (
                <button
                  key={piece.key}
                  type="button"
                  disabled={!piece.enabled}
                  onClick={() => onSelectPiece(piece.key)}
                  className={`hero-rail-tab ${isActive ? "is-active" : "is-inactive"}`}
                  aria-label={piece.label}
                >
                  <picture
                    className={[
                      "h-7 w-7 shrink-0",
                      isActive
                        ? `piece-hero ${plopping ? "animate-[hero-plop_300ms_cubic-bezier(0.34,1.56,0.64,1)]" : ""}`
                        : "piece-inactive",
                    ].join(" ")}
                  >
                    <source srcSet={`${src}.avif`} type="image/avif" />
                    <source srcSet={`${src}.webp`} type="image/webp" />
                    <img
                      src={`${src}.png`}
                      alt={piece.label}
                      className="h-full w-full object-contain"
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.style.display = "none";
                        const fallback = document.createElement("span");
                        fallback.textContent = piece.label[0];
                        fallback.className = "text-[20px] leading-none text-slate-400";
                        target.parentElement?.appendChild(fallback);
                      }}
                    />
                  </picture>
                  {isActive && (
                    <span className="text-[8px] font-extrabold uppercase tracking-[0.15em] text-[rgba(220,200,150,0.9)]">
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

        </div>

      </div>

      {/* Zone B: Board Stage — flex-1, maximum space */}
      <div className="min-h-0 flex-1 px-1 mt-1">
        <div className="h-full rounded-xl overflow-hidden border border-white/[0.04] shadow-[inset_0_0_40px_rgba(0,0,0,0.3),0_4px_20px_rgba(0,0,0,0.25)]">
          {board}
        </div>
        {isReplay && (
          <p className="px-2 py-1 text-center text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-cyan-400/50">
            {PRACTICE_COPY.label}
          </p>
        )}
      </div>

      {/* GameplayPanel — mission + stats + action */}
      <GameplayPanel
        mission={missionContent}
        stats={statsContent}
        action={contextualAction}
      />

      {/* Dock — persistent navigation, separate from GameplayPanel */}
      <div className="shrink-0" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        {persistentDock}
      </div>

      {/* Fullscreen phase flash — auto-fades */}
      <PhaseFlash phase={phase} />
    </section>
  );
}
