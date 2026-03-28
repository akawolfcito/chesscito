"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { COACH_COPY } from "@/lib/content/editorial";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBuy: (pack: 5 | 20) => void;
  onQuickReview: () => void;
};

export function CoachPaywall({ open, onOpenChange, onBuy, onQuickReview }: Props) {
  const [toast, setToast] = useState(false);

  function handleBuy(pack: 5 | 20) {
    setToast(true);
    setTimeout(() => setToast(false), 2000);
    onBuy(pack);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mission-shell rounded-t-3xl border-slate-700">
        <SheetHeader>
          <SheetTitle className="fantasy-title text-cyan-50">{COACH_COPY.creditTitle}</SheetTitle>
          <SheetDescription className="text-cyan-100/75">{COACH_COPY.creditExplain}</SheetDescription>
        </SheetHeader>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleBuy(5)}
            className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-center transition-all hover:bg-white/[0.06]"
          >
            <p className="text-lg font-bold text-white">{COACH_COPY.creditPack5}</p>
            <p className="text-sm text-cyan-100/50">$0.05</p>
            <p className="mt-1 text-xs text-cyan-100/40">{COACH_COPY.creditPackSubtitle(5)}</p>
          </button>
          <button
            type="button"
            onClick={() => handleBuy(20)}
            className="rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.06] ring-1 ring-emerald-400/10 p-4 text-center transition-all hover:bg-emerald-500/[0.08]"
          >
            <p className="text-lg font-bold text-white">{COACH_COPY.creditPack20}</p>
            <p className="text-sm text-cyan-100/50">$0.10</p>
            <p className="mt-1 text-xs text-cyan-100/40">{COACH_COPY.creditPackSubtitle(20)}</p>
            <span className="mt-1 inline-block rounded-full bg-emerald-500/20 px-2 py-0.5 text-[0.6rem] font-bold text-emerald-300">{COACH_COPY.creditBest}</span>
          </button>
        </div>
        {toast && (
          <p className="mt-3 text-center text-sm font-semibold text-amber-400 animate-in fade-in duration-200">
            {COACH_COPY.creditComingSoon}
          </p>
        )}
        <p className="mt-4 text-center text-[0.65rem] text-cyan-100/25">
          <button type="button" onClick={onQuickReview} className="underline hover:text-cyan-100/50">
            {COACH_COPY.orQuickReview}
          </button>
        </p>
      </SheetContent>
    </Sheet>
  );
}
