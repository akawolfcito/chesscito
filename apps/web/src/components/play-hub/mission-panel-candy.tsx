"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { MISSION_BRIEFING_COPY, PHASE_FLASH_COPY, PIECE_IMAGES, PIECE_LABELS } from "@/lib/content/editorial";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import { PiecePickerSheet } from "@/components/play-hub/piece-picker-sheet";
import { MissionDetailSheet } from "@/components/play-hub/mission-detail-sheet";
import { THEME_CONFIG } from "@/lib/theme";

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
            <source srcSet="/art/favicon-wolf.avif" type="image/avif" />
            <source srcSet="/art/favicon-wolf.webp" type="image/webp" />
            <img
              src="/art/favicon-wolf.png"
              alt=""
              aria-hidden="true"
              className="h-20 w-20 drop-shadow-[var(--accent-drop-shadow)]"
            />
          </picture>
        </div>
        <span
          className={`fantasy-title victory-text-slam text-3xl ${flash.accent}`}
          style={{
            textShadow: phase === "success" ? "var(--text-shadow-hero-emerald)" : "var(--text-shadow-hero-rose)",
          }}
        >
          {flash.text}
        </span>
      </div>
    </div>
  );
}

export function MissionPanelCandy({
  selectedPiece,
  onSelectPiece,
  pieces,
  phase,
  targetLabel,
  score,
  timeMs,
  board,
  exerciseDrawer,
  contextualAction,
  persistentDock,
  isCapture = false,
}: MissionPanelProps) {
  const activePiece = pieces.find((p) => p.key === selectedPiece);
  const activeSrc = PIECE_IMAGES[selectedPiece as keyof typeof PIECE_IMAGES];

  const pieceChip = (
    <button
      type="button"
      className="flex items-center gap-2 rounded-full border border-white/[0.10] bg-[var(--surface-c-mid)] px-2.5 py-1.5 backdrop-blur-md transition-all active:scale-[0.97]"
      aria-label={`Switch piece (current: ${activePiece?.label ?? selectedPiece})`}
    >
      <picture className="h-7 w-7 shrink-0">
        {THEME_CONFIG.hasOptimizedFormats && (
          <>
            <source srcSet={`${activeSrc}.avif`} type="image/avif" />
            <source srcSet={`${activeSrc}.webp`} type="image/webp" />
          </>
        )}
        <img
          src={`${activeSrc}.png`}
          alt=""
          aria-hidden="true"
          className="h-full w-full object-contain"
        />
      </picture>
      <span
        className="fantasy-title text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--warm-label-text)]"
        style={{ textShadow: "var(--text-shadow-label)" }}
      >
        {activePiece?.label ?? PIECE_LABELS[selectedPiece as keyof typeof PIECE_LABELS]}
      </span>
      <CandyIcon name="chevron-down" className="h-3.5 w-3.5 opacity-70" />
    </button>
  );

  const missionPeek = (
    <button
      type="button"
      className="candy-frame candy-frame-amber mx-2 flex w-[calc(100%-1rem)] items-center gap-3 overflow-hidden px-4 py-2.5 text-left"
      style={{ marginTop: "var(--shell-gap-xs)" }}
      aria-label="Open mission details"
    >
      <p key={targetLabel} className="mission-typewriter flex-1 truncate text-sm font-bold">
        {isCapture
          ? <>Move your {PIECE_LABELS[selectedPiece as keyof typeof PIECE_LABELS]} to <span className="text-rose-700">CAPTURE</span></>
          : <>{MISSION_BRIEFING_COPY.targetPrefix} <span className="text-amber-900">{targetLabel}</span></>}
      </p>
      <span className="flex shrink-0 items-center gap-1.5">
        <span className="game-label text-xs font-extrabold tabular-nums">
          {score}
        </span>
        <span className="h-2 w-2 rounded-full bg-amber-900/80 shadow-[0_0_4px_rgba(120,65,5,0.5)]" aria-hidden="true" />
      </span>
    </button>
  );

  return (
    <section className="mission-shell mission-shell-candy atmosphere flex h-[100dvh] flex-col overflow-hidden">
      {/* Zone A: compact header — piece chip + exercise drawer */}
      <div className="shrink-0 mx-2 mt-2 flex items-center gap-2">
        <PiecePickerSheet
          selectedPiece={selectedPiece}
          pieces={pieces}
          onSelectPiece={onSelectPiece}
          trigger={pieceChip}
        />
        <span className="ml-auto">{exerciseDrawer}</span>
      </div>

      {/* Zone B: Board Stage — flex-1, maximum space. No panel frame so the
          board image floats directly on the grass field bg. */}
      <div className="board-stage-focus min-h-0 flex-1 mx-2 mt-2">
        {board}
      </div>

      {/* Mission peek — single line, tap to expand */}
      <MissionDetailSheet
        selectedPiece={selectedPiece as keyof typeof PIECE_LABELS}
        targetLabel={targetLabel}
        isCapture={isCapture}
        score={score}
        timeMs={timeMs}
        trigger={missionPeek}
      />

      {/* Contextual action — only rendered when present (claim badge, retry, etc.) */}
      {contextualAction ? (
        <div className="mx-2 mt-2 shrink-0">{contextualAction}</div>
      ) : null}

      {/* Dock — persistent navigation. z-[60] must live on the direct
          child of .atmosphere to escape the z-index: 1 stacking context
          that .atmosphere > * establishes — otherwise the dock's own
          z-60 is trapped inside the parent's z-1 context and loses to
          the Radix Sheet portal (z-50) at body root. */}
      <div
        className="shrink-0 relative z-[60]"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)", marginTop: "var(--shell-gap-sm)" }}
      >
        {persistentDock}
      </div>

      {/* Fullscreen phase flash — auto-fades */}
      <PhaseFlash phase={phase} />
    </section>
  );
}
