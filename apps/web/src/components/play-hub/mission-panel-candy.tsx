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
  /** Total stars earned on the current piece (0–15). Feeds the
   *  mission-detail journey rail so the user sees how close they are
   *  to claiming the badge. */
  currentStars: number;
  /** On-chain badge claim status per piece. Feeds the journey rail
   *  unlock/locked tiers. */
  claimedBadges: Partial<Record<PieceOption["key"], boolean>>;
  /** Signal from the parent that a dock destination sheet is open.
   *  When true, we close piece-picker and mission-detail so the user
   *  never sees a picker stacked behind a badge/shop/leaderboard
   *  sheet. */
  isDockSheetOpen: boolean;
};

type FlashConfig = { text: string; accent: string };

const PHASE_FLASH: Record<MissionPanelProps["phase"], FlashConfig | null> = {
  ready: null,
  success: { text: PHASE_FLASH_COPY.success, accent: "rgb(4, 120, 87)" },
  failure: { text: PHASE_FLASH_COPY.failure, accent: "rgb(159, 18, 57)" },
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
      className={`pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-scrim)] transition-opacity duration-400 ${fading ? "opacity-0" : "opacity-100"}`}
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
              className="h-20 w-20 drop-shadow-[0_4px_12px_rgba(120,65,5,0.45)]"
            />
          </picture>
        </div>
        <span
          className="fantasy-title victory-text-slam text-3xl font-extrabold"
          style={{
            color: flash.accent,
            textShadow: "0 2px 0 rgba(255, 245, 215, 0.80)",
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
  currentStars,
  claimedBadges,
  isDockSheetOpen,
}: MissionPanelProps) {
  const activePiece = pieces.find((p) => p.key === selectedPiece);
  const activeSrc = PIECE_IMAGES[selectedPiece as keyof typeof PIECE_IMAGES];

  // Quick-picker (Type C) open state — owned here so we can auto-close
  // them when the parent signals a dock destination sheet is opening.
  const [piecePickerOpen, setPiecePickerOpen] = useState(false);
  const [missionDetailOpen, setMissionDetailOpen] = useState(false);

  useEffect(() => {
    if (isDockSheetOpen) {
      setPiecePickerOpen(false);
      setMissionDetailOpen(false);
    }
  }, [isDockSheetOpen]);

  const pieceChip = (
    <button
      type="button"
      className="flex items-center gap-2 rounded-full border border-amber-300/25 bg-[var(--surface-c-mid)] px-2.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_1px_3px_rgba(0,0,0,0.35)] backdrop-blur-md transition-all active:scale-[0.97]"
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
      className="flex min-h-[44px] items-center gap-2 rounded-full border border-amber-300/25 bg-[var(--surface-c-mid)] px-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_1px_3px_rgba(0,0,0,0.35),0_0_10px_rgba(245,158,11,0.18)] backdrop-blur-md transition-all active:scale-[0.97]"
      aria-label={`Open mission details${isCapture ? " — capture target" : ` — target ${targetLabel}`}`}
    >
      <CandyIcon
        name="crosshair"
        className="h-4 w-4 shrink-0"
        style={{ filter: "drop-shadow(0 0 2px rgba(245,158,11,0.5))" }}
      />
      <span
        key={targetLabel}
        className="fantasy-title text-xs font-extrabold text-[var(--warm-label-text)]"
        style={{ textShadow: "var(--text-shadow-label)" }}
      >
        {isCapture ? "Capture" : `${MISSION_BRIEFING_COPY.targetPrefix.replace(":", "")} ${targetLabel}`}
      </span>
    </button>
  );

  return (
    <section className="mission-shell mission-shell-candy atmosphere flex h-[100dvh] flex-col overflow-hidden">
      {/* Zone A: context header — piece chip + mission chip + exercise drawer.
          Piece identity and current mission target live here together so the
          action row below can be dedicated to the CTA pin. */}
      <div className="shrink-0 mx-2 mt-2 flex items-center gap-2">
        <PiecePickerSheet
          open={piecePickerOpen}
          onOpenChange={setPiecePickerOpen}
          selectedPiece={selectedPiece}
          pieces={pieces}
          onSelectPiece={onSelectPiece}
          trigger={pieceChip}
        />
        <MissionDetailSheet
          open={missionDetailOpen}
          onOpenChange={setMissionDetailOpen}
          selectedPiece={selectedPiece as keyof typeof PIECE_LABELS}
          targetLabel={targetLabel}
          isCapture={isCapture}
          score={score}
          timeMs={timeMs}
          currentStars={currentStars}
          claimedBadges={claimedBadges}
          trigger={missionPeek}
        />
        <span className="ml-auto">{exerciseDrawer}</span>
      </div>

      {/* Zone B: Board Stage — flex-1, maximum space. No panel frame so the
          board image floats directly on the grass field bg. */}
      <div className="board-stage-focus min-h-0 flex-1 mx-2 mt-2">
        {board}
      </div>

      {/* Zone C: action pin — centered, now the sole inhabitant of this row
          so the CTA is the visual anchor of the bottom half. */}
      <div
        className="mx-2 flex shrink-0 items-center justify-center"
        style={{ marginTop: "var(--shell-gap-xs)" }}
      >
        {contextualAction}
      </div>

      {/* Dock — persistent navigation.
          - z-[60] on the direct child of .atmosphere escapes the
            z-index: 1 stacking context that .atmosphere > * forces.
          - pointer-events-auto re-enables clicks while a Radix Sheet
            is open. Radix in modal=true sets pointer-events: none on
            the portal's siblings (our entire page tree) so outside
            clicks can't hit underlying elements. That also disables
            the dock visually-on-top. pointer-events: auto on the
            wrapper restores interactivity for dock + descendants
            without touching Radix's modal semantics elsewhere. */}
      <div
        className="shrink-0 relative z-[60] pointer-events-auto"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)", marginTop: "var(--shell-gap-sm)" }}
      >
        {persistentDock}
      </div>

      {/* Fullscreen phase flash — auto-fades */}
      <PhaseFlash phase={phase} />
    </section>
  );
}
