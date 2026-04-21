"use client";

import { CandyIcon } from "@/components/redesign/candy-icon";
import { PaperPanel } from "@/components/redesign/paper-panel";
import { JourneyRail } from "@/components/redesign/journey-rail";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  MISSION_BRIEFING_COPY,
  MISSION_DETAIL_COPY,
  PIECE_IMAGES,
  PIECE_LABELS,
  SCORE_UNIT,
} from "@/lib/content/editorial";
import { THEME_CONFIG } from "@/lib/theme";
import type { PieceId } from "@/lib/game/types";

type Props = {
  /** Controlled open state — parent closes it when a dock sheet opens,
   *  so the user never sees stacked pickers. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPiece: PieceId;
  targetLabel: string;
  isCapture: boolean;
  score: string;
  timeMs: string;
  /** Total stars earned on the current piece (0–15). Powers the journey
   *  rail "badge" tier progress. */
  currentStars: number;
  /** On-chain badge claim status per piece. Drives the journey rail
   *  unlock/locked states. */
  claimedBadges: Partial<Record<PieceId, boolean>>;
  /** The peek-card element that opens the sheet. */
  trigger: React.ReactNode;
};

export function MissionDetailSheet({
  open,
  onOpenChange,
  selectedPiece,
  targetLabel,
  isCapture,
  score,
  timeMs,
  currentStars,
  claimedBadges,
  trigger,
}: Props) {
  const pieceSrc = PIECE_IMAGES[selectedPiece as keyof typeof PIECE_IMAGES];
  const hasStats = Number(score) > 0 || Number(timeMs) > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        side="bottom"
        className="mission-shell flex h-[100dvh] flex-col items-center justify-center rounded-none border-transparent bg-transparent p-4 shadow-none"
      >
        {/* Radix a11y: headless title/description — visible title lives
            inside the PaperPanel ribbon. */}
        <SheetTitle className="sr-only">{MISSION_DETAIL_COPY.title}</SheetTitle>
        <SheetDescription className="sr-only">
          {MISSION_DETAIL_COPY.title}
        </SheetDescription>

        <PaperPanel
          ribbonTitle={MISSION_DETAIL_COPY.title}
          onClose={() => onOpenChange(false)}
          closeLabel={MISSION_DETAIL_COPY.title}
        >
          {/* Hero: piece art + target */}
          <div className="flex items-center gap-3">
            <picture className="h-14 w-14 shrink-0 drop-shadow-[0_2px_6px_rgba(120,65,5,0.35)]">
              {THEME_CONFIG.hasOptimizedFormats && (
                <>
                  <source srcSet={`${pieceSrc}.avif`} type="image/avif" />
                  <source srcSet={`${pieceSrc}.webp`} type="image/webp" />
                </>
              )}
              <img
                src={`${pieceSrc}.png`}
                alt=""
                aria-hidden="true"
                className="h-full w-full object-contain"
              />
            </picture>
            <div className="flex-1 min-w-0">
              <p className="text-[0.95rem] font-bold leading-tight" style={{ color: "var(--paper-text)" }}>
                {isCapture ? (
                  <>
                    Move your {PIECE_LABELS[selectedPiece]} to{" "}
                    <span className="text-rose-700">CAPTURE</span>
                  </>
                ) : (
                  <>
                    {MISSION_BRIEFING_COPY.targetPrefix}{" "}
                    <span className="text-amber-700">{targetLabel}</span>
                  </>
                )}
              </p>
              <p className="mt-0.5 text-xs leading-tight" style={{ color: "var(--paper-text-muted)" }}>
                {MISSION_BRIEFING_COPY.moveHint[selectedPiece]}
              </p>
            </div>
          </div>

          {/* Stats row (pre-first-move or running stats) */}
          {hasStats ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="paper-tray flex flex-col !py-1.5 !px-2">
                <span className="flex items-center gap-1 text-[0.65rem] font-bold uppercase tracking-[0.10em]" style={{ color: "var(--paper-text-muted)" }}>
                  <CandyIcon name="star" className="h-3 w-3" />
                  {MISSION_DETAIL_COPY.scoreLabel}
                </span>
                <p className="mt-0.5 text-base font-bold tabular-nums" style={{ color: "var(--paper-text)" }}>
                  {score}{" "}
                  <span className="text-xs" style={{ color: "var(--paper-text-muted)" }}>
                    {SCORE_UNIT}
                  </span>
                </p>
              </div>
              <div className="paper-tray flex flex-col !py-1.5 !px-2">
                <span className="flex items-center gap-1 text-[0.65rem] font-bold uppercase tracking-[0.10em]" style={{ color: "var(--paper-text-muted)" }}>
                  <CandyIcon name="time" className="h-3 w-3" />
                  {MISSION_DETAIL_COPY.timeLabel}
                </span>
                <p className="mt-0.5 text-base font-bold tabular-nums" style={{ color: "var(--paper-text)" }}>
                  {Number(timeMs) / 1000}s
                </p>
              </div>
            </div>
          ) : (
            <p className="text-center text-xs" style={{ color: "var(--paper-text-subtle)" }}>
              {MISSION_DETAIL_COPY.preFirstMoveHint}
            </p>
          )}

          {/* Journey — where am I, what's next. */}
          <div>
            <p className="mb-1 text-[0.62rem] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--paper-text-muted)" }}>
              Your journey
            </p>
            <JourneyRail
              currentPiece={selectedPiece}
              currentStars={currentStars}
              claimedBadges={claimedBadges}
            />
          </div>
        </PaperPanel>
      </SheetContent>
    </Sheet>
  );
}
