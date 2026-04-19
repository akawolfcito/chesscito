"use client";

import { useState } from "react";
import { CandyIcon } from "@/components/redesign/candy-icon";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  MISSION_BRIEFING_COPY,
  MISSION_DETAIL_COPY,
  PIECE_LABELS,
  SCORE_UNIT,
} from "@/lib/content/editorial";

type Props = {
  selectedPiece: keyof typeof PIECE_LABELS;
  targetLabel: string;
  isCapture: boolean;
  score: string;
  timeMs: string;
  /** The peek-card element that opens the sheet. */
  trigger: React.ReactNode;
};

export function MissionDetailSheet({
  selectedPiece,
  targetLabel,
  isCapture,
  score,
  timeMs,
  trigger,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        side="bottom"
        className="mission-shell rounded-t-3xl border-white/[0.10]"
        style={{ background: "var(--surface-b)", backdropFilter: "blur(20px)" }}
      >
        <div className="border-b border-[var(--header-zone-border)] bg-[var(--header-zone-bg)] -mx-6 -mt-6 rounded-t-3xl px-6 py-5">
          <SheetHeader>
            <SheetTitle className="fantasy-title text-slate-100">
              {MISSION_DETAIL_COPY.title}
            </SheetTitle>
          </SheetHeader>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <picture className="h-14 w-14 shrink-0">
            <source srcSet="/art/favicon-wolf.webp" type="image/webp" />
            <img
              src="/art/favicon-wolf.png"
              alt=""
              aria-hidden="true"
              className="h-full w-full object-contain drop-shadow-[var(--accent-drop-shadow-sm)]"
            />
          </picture>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-slate-50">
              {isCapture ? (
                <>
                  Move your {PIECE_LABELS[selectedPiece]} to{" "}
                  <span className="text-rose-400">CAPTURE</span>
                </>
              ) : (
                <>
                  {MISSION_BRIEFING_COPY.targetPrefix}{" "}
                  <span className="text-cyan-300">{targetLabel}</span>
                </>
              )}
            </p>
            <p className="mt-1 text-sm text-cyan-100/55">
              {MISSION_BRIEFING_COPY.moveHint[selectedPiece]}
            </p>
          </div>
        </div>

        {Number(score) > 0 || Number(timeMs) > 0 ? (
          <div className="mt-5 grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.04] px-3 py-2.5">
              <span className="game-label flex items-center gap-1 text-xs font-bold uppercase tracking-[0.10em] text-white/55">
                <CandyIcon name="star" className="h-3 w-3" />
                {MISSION_DETAIL_COPY.scoreLabel}
              </span>
              <p className="mt-1 text-lg font-bold tabular-nums text-white">
                {score} <span className="text-sm text-white/45">{SCORE_UNIT}</span>
              </p>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.04] px-3 py-2.5">
              <span className="game-label flex items-center gap-1 text-xs font-bold uppercase tracking-[0.10em] text-white/55">
                <CandyIcon name="time" className="h-3 w-3" />
                {MISSION_DETAIL_COPY.timeLabel}
              </span>
              <p className="mt-1 text-lg font-bold tabular-nums text-white">
                {Number(timeMs) / 1000}s
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-5 text-center text-sm text-cyan-100/45">
            {MISSION_DETAIL_COPY.preFirstMoveHint}
          </p>
        )}
      </SheetContent>
    </Sheet>
  );
}
