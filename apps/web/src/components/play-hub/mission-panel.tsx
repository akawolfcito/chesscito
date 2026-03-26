"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Star, Timer } from "lucide-react";
import { PHASE_FLASH_COPY, PIECE_IMAGES, PRACTICE_COPY } from "@/lib/content/editorial";

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

  return (
    <section className="mission-shell flex h-[100dvh] flex-col overflow-hidden">
      {/* Zone A: Hero Selector — rail + mission target, fixed layout */}
      <div className="shrink-0 w-full px-4 pt-[max(env(safe-area-inset-top),12px)]">
        {/* Piece selector rail — fixed 60px height */}
        <div className="flex justify-center">
          <div className="hero-rail">
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

        {/* Mission label slot — fixed 48px height */}
        <div className="mt-3 h-12 text-center">
          {pieceHint ? (
            <p className="text-[11px] font-medium text-cyan-200/50">{pieceHint}</p>
          ) : (
            <>
              <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-cyan-400/25">
                Move to
              </p>
              <p className="text-xl font-black text-cyan-400/90 drop-shadow-[0_0_12px_rgba(34,211,238,0.20)]">
                {targetLabel}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Zone A2: Utility Band — Lv + stars + more */}
      <div
        className="flex shrink-0 items-center justify-between px-4 h-8"
        style={{ background: "linear-gradient(180deg, rgba(12,20,35,0.42) 0%, rgba(6,14,28,0.24) 100%)", borderTop: "1px solid rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(0,0,0,0.15)" }}
      >
        <span className="text-[11px] font-bold text-purple-400/60">
          Lv {level}
        </span>
        <div className="flex items-center gap-2">
          {exerciseDrawer}
          {moreAction && (
            <div className="[&>button]:flex [&>button]:h-10 [&>button]:w-10 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-full [&>button]:border [&>button]:border-white/[0.12] [&>button]:bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.04))] [&>button]:text-white/60 [&>button]:shadow-[inset_0_1px_2px_rgba(255,255,255,0.04),inset_0_-1px_2px_rgba(0,0,0,0.15),0_1px_3px_rgba(0,0,0,0.2)] [&>button]:transition-all [&>button]:active:scale-95 [&>button]:active:bg-white/[0.12]">
              {moreAction}
            </div>
          )}
        </div>
      </div>

      {/* Zone B: Board Stage — flex-1, maximum space */}
      <div className="min-h-0 flex-1 px-1 mt-2">
        <div className="h-full rounded-lg overflow-hidden shadow-[inset_0_0_40px_rgba(0,0,0,0.3)]">
          {board}
        </div>
        {isReplay && (
          <p className="px-2 py-1 text-center text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-cyan-400/50">
            {PRACTICE_COPY.label}
          </p>
        )}
      </div>

      {/* Visual transition between board and footer */}
      <div className="h-px bg-gradient-to-r from-transparent via-cyan-400/10 to-transparent" />

      {/* Zone C: Footer — micro-stats + CTA merged, then dock */}
      <div className="chesscito-footer shrink-0">
        {/* Layer 1: Micro-stats + CTA (merged) */}
        <div className="mx-2 flex items-center justify-center gap-4 rounded-[10px] py-1.5 px-3" style={{ background: "rgba(0,0,0,0.13)", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
          <span className="flex items-center gap-1 text-[10px] font-semibold text-white/40">
            <Star size={12} className="opacity-30" />
            {score}
          </span>
          <span className="text-[10px] text-white/15">&middot;</span>
          <span className="flex items-center gap-1 text-[10px] font-semibold text-white/40">
            <Timer size={12} className="opacity-30" />
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
