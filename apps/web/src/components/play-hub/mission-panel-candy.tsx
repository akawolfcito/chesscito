"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { LABYRINTH_COPY, MISSION_BRIEFING_COPY, PHASE_FLASH_COPY, PIECE_IMAGES, PIECE_LABELS } from "@/lib/content/editorial";
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
  /** L2 layer toggle. Visible only when labyrinthAvailable. Lets the
   *  player switch between L1 exercises and L2 labyrinths inline. */
  labyrinthAvailable?: boolean;
  labyrinthMode?: boolean;
  onToggleLabyrinth?: (next: boolean) => void;
};

type FlashConfig = { text: string; accent: string; stroke: string };

/* Warm-amber on grass reads better than emerald or rose. The stroke
   is the darkest paper-text brown so the glyph silhouette stays
   crisp against any background (forest, paper, etc.). */
const PHASE_FLASH: Record<MissionPanelProps["phase"], FlashConfig | null> = {
  ready: null,
  success: {
    text: PHASE_FLASH_COPY.success,
    accent: "rgb(245, 158, 11)",        // amber-500
    stroke: "rgba(63, 34, 8, 0.95)",    // darkest paper text
  },
  failure: {
    text: PHASE_FLASH_COPY.failure,
    accent: "rgb(244, 63, 94)",         // rose-500
    stroke: "rgba(63, 34, 8, 0.95)",
  },
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
      className={`pointer-events-none fixed inset-0 z-50 flex items-center justify-center candy-modal-scrim transition-opacity duration-400 ${fading ? "opacity-0" : "opacity-100"}`}
    >
      <div className="flex flex-col items-center gap-2 animate-in zoom-in-90 duration-300">
        <div className="relative flex h-32 w-32 items-center justify-center">
          {phase === "success" && (
            <div className="pointer-events-none absolute inset-0">
              <LottieAnimation src="/animations/sparkle-burst.lottie" loop={false} className="h-full w-full" />
            </div>
          )}
          {/* Soft warm halo behind the mascot — gives the figure mass
              without competing with the sparkle burst on success. */}
          <div
            className="pointer-events-none absolute h-28 w-28 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(245, 158, 11, 0.32) 0%, rgba(245, 158, 11, 0.10) 55%, transparent 80%)",
            }}
          />
          <picture className="relative z-10">
            <source srcSet="/art/favicon-wolf.avif" type="image/avif" />
            <source srcSet="/art/favicon-wolf.webp" type="image/webp" />
            <img
              src="/art/favicon-wolf.png"
              alt=""
              aria-hidden="true"
              className="h-24 w-24 drop-shadow-[0_4px_14px_rgba(120,65,5,0.55)]"
              style={{ animation: "reward-icon-enter 320ms cubic-bezier(0.34, 1.56, 0.64, 1) both" }}
            />
          </picture>
        </div>
        <span
          /* Stroke (via -webkit-text-stroke) gives the glyphs a crisp
             dark outline so the warm-amber fill pops against any
             backdrop. text-shadow adds a soft cream halo for depth. */
          className="fantasy-title victory-text-slam text-5xl font-extrabold leading-none"
          style={{
            color: flash.accent,
            WebkitTextStroke: `2px ${flash.stroke}`,
            textShadow:
              "0 2px 0 rgba(255, 245, 215, 0.85), 0 4px 10px rgba(120, 65, 5, 0.40)",
            paintOrder: "stroke fill",
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
  labyrinthAvailable = false,
  labyrinthMode = false,
  onToggleLabyrinth,
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

  /* Candy-palette chip class — replaces the legacy var(--surface-c-mid)
     dark navy background that was leftover from the pre-candy era.
     Warm cream paper bg + warm-brown text + soft amber border so the
     header reads as part of the same family as the candy modals,
     dock sheets, and the toggle pill below. */
  const candyChipClass =
    "flex min-h-[40px] items-center gap-2 rounded-full border px-3 py-1.5 transition-all active:scale-[0.97]";
  const candyChipStyle = {
    background: "rgba(255, 245, 215, 0.55)",
    borderColor: "rgba(110, 65, 15, 0.28)",
    boxShadow:
      "inset 0 1px 0 rgba(255, 245, 215, 0.65), 0 1px 3px rgba(120, 65, 5, 0.18)",
  } as const;
  const candyChipText =
    "fantasy-title text-xs font-extrabold uppercase tracking-[0.12em]";
  const candyChipTextStyle = {
    color: "rgba(63, 34, 8, 0.95)",
    textShadow: "0 1px 0 rgba(255, 245, 215, 0.65)",
  } as const;

  const pieceChip = (
    <button
      type="button"
      className={candyChipClass}
      style={candyChipStyle}
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
      <span className={candyChipText} style={candyChipTextStyle}>
        {activePiece?.label ?? PIECE_LABELS[selectedPiece as keyof typeof PIECE_LABELS]}
      </span>
      <CandyIcon name="chevron-down" className="h-3.5 w-3.5 opacity-70" />
    </button>
  );

  const missionPeek = (
    <button
      type="button"
      className={`${candyChipClass} min-h-[44px]`}
      style={candyChipStyle}
      aria-label={`Open mission details${isCapture ? " — capture target" : ` — target ${targetLabel}`}`}
    >
      <CandyIcon
        name="crosshair"
        className="h-4 w-4 shrink-0"
      />
      <span
        key={targetLabel}
        className="fantasy-title text-xs font-extrabold"
        style={candyChipTextStyle}
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

      {/* L2 Layer toggle — only visible after L1 mastery + labyrinths
          exist for this piece. Restyled to match the chip row above
          (border-amber-300/25, surface-c-mid, fantasy-title cap text,
          backdrop blur, glow on active) so it feels native to the
          game rather than a generic form control. */}
      {labyrinthAvailable && onToggleLabyrinth && (
        <div className="shrink-0 mx-2 mt-2 flex justify-center">
          <div
            className="inline-flex items-center gap-1 rounded-full border p-0.5"
            style={{
              background: "rgba(255, 245, 215, 0.55)",
              borderColor: "rgba(110, 65, 15, 0.28)",
              boxShadow:
                "inset 0 1px 0 rgba(255, 245, 215, 0.65), 0 1px 3px rgba(120, 65, 5, 0.18)",
            }}
            role="tablist"
            aria-label="Layer toggle"
          >
            {[
              { active: !labyrinthMode, value: false, label: LABYRINTH_COPY.toggleExercises },
              { active: labyrinthMode, value: true, label: LABYRINTH_COPY.toggleLabyrinths },
            ].map(({ active, value, label }) => (
              <button
                key={label}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onToggleLabyrinth(value)}
                className={[
                  "rounded-full px-3.5 py-1.5 transition-all active:scale-[0.97]",
                  "fantasy-title text-[0.7rem] font-extrabold uppercase tracking-[0.12em]",
                  active
                    ? "bg-amber-500/85 shadow-[0_0_10px_rgba(245,158,11,0.45),inset_0_1px_0_rgba(255,245,215,0.55)]"
                    : "",
                ].join(" ")}
                style={{
                  color: active ? "rgba(63, 34, 8, 0.95)" : "rgba(110, 65, 15, 0.70)",
                  textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

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
