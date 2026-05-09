"use client";

import { CandyIcon } from "@/components/redesign/candy-icon";
import { GemBadge } from "@/components/scene-rooted/gem";
import { WoodBanner } from "@/components/scene-rooted/wood-banner";
import { JourneyRail } from "@/components/redesign/journey-rail";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
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
        className="mission-shell sheet-bg-hub rounded-t-3xl border-0 pb-[5rem]"
      >
        <div className="border-b border-[rgba(110,65,15,0.30)] -mx-6 -mt-6 rounded-t-3xl px-6 py-5">
          <SheetHeader>
            <SheetTitle
              className="fantasy-title"
              style={{
                color: "rgba(110, 65, 15, 0.95)",
                textShadow: "0 1px 0 rgba(255, 245, 215, 0.80)",
              }}
            >
              {MISSION_DETAIL_COPY.title}
            </SheetTitle>
            <SheetDescription className="sr-only">
              {MISSION_DETAIL_COPY.title}
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="mt-4 space-y-3">
          {/* Hero: piece art + target */}
          <div className="flex items-center gap-3 rounded-2xl border border-[rgba(255,255,255,0.45)] bg-white/15 p-3">
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
            <div className="min-w-0 flex-1">
              <p
                className="text-[0.95rem] font-extrabold leading-tight"
                style={{
                  color: "rgba(63, 34, 8, 0.95)",
                  textShadow: "0 1px 0 rgba(255, 245, 215, 0.65)",
                }}
              >
                {isCapture ? (
                  <>
                    Move your {PIECE_LABELS[selectedPiece]} to{" "}
                    <span style={{ color: "rgba(159, 18, 57, 0.95)" }}>CAPTURE</span>
                  </>
                ) : (
                  <>
                    {MISSION_BRIEFING_COPY.targetPrefix}{" "}
                    <span style={{ color: "rgba(120, 65, 5, 0.95)" }}>{targetLabel}</span>
                  </>
                )}
              </p>
              <p
                className="mt-0.5 text-xs leading-tight"
                style={{ color: "rgba(110, 65, 15, 0.75)" }}
              >
                {MISSION_BRIEFING_COPY.moveHint[selectedPiece]}
              </p>
            </div>
          </div>

          {/* Stats row (pre-first-move or running stats). Single-line
              gem-shaped indicators per scene-rooted vocabulary: icon
              encodes the dimension (star = score, time = duration);
              value carries number + unit. The previous label rows
              ("SCORE", "TIME") are implicit via the icons. */}
          {hasStats ? (
            <div className="flex flex-wrap items-center justify-center gap-3">
              <GemBadge
                tone="default"
                icon={<CandyIcon name="star" className="h-3 w-3" />}
                value={`${score} ${SCORE_UNIT}`}
              />
              <GemBadge
                tone="default"
                icon={<CandyIcon name="time" className="h-3 w-3" />}
                value={`${Number(timeMs) / 1000}s`}
              />
            </div>
          ) : (
            <p
              className="text-center text-xs"
              style={{ color: "rgba(110, 65, 15, 0.65)" }}
            >
              {MISSION_DETAIL_COPY.preFirstMoveHint}
            </p>
          )}

          {/* Journey — where am I, what's next. The wood-grain banner
              frames the section title; the JourneyRail renders the
              progression visually below it. */}
          <div className="flex flex-col items-center gap-2">
            <WoodBanner size="medium" asTitle>
              Your journey
            </WoodBanner>
            <div className="w-full">
              <JourneyRail
                currentPiece={selectedPiece}
                currentStars={currentStars}
                claimedBadges={claimedBadges}
              />
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
