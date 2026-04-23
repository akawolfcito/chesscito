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
  const [buying, setBuying] = useState<5 | 20 | null>(null);

  function handleBuy(pack: 5 | 20) {
    setBuying(pack);
    onBuy(pack);
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!buying) onOpenChange(v); }}>
      <SheetContent
        side="bottom"
        className="mission-shell sheet-bg-hub flex h-[100dvh] flex-col rounded-none border-0 pb-[5rem]"
      >
        <div className="border-b border-[rgba(110,65,15,0.30)] -mx-6 -mt-6 rounded-t-3xl px-6 py-5 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
          <SheetHeader>
            <SheetTitle
              className="fantasy-title"
              style={{
                color: "rgba(110, 65, 15, 0.95)",
                textShadow: "0 1px 0 rgba(255, 245, 215, 0.80)",
              }}
            >
              {COACH_COPY.creditTitle}
            </SheetTitle>
            <SheetDescription style={{ color: "rgba(110, 65, 15, 0.75)" }}>
              {COACH_COPY.creditExplain}
            </SheetDescription>
          </SheetHeader>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={buying !== null}
            onClick={() => handleBuy(5)}
            className="candy-frame candy-frame-amber min-h-[56px] p-4 text-center disabled:opacity-60"
          >
            <p className="text-lg font-extrabold">{COACH_COPY.creditPack5}</p>
            <p className="text-sm opacity-75">$0.05</p>
            <p className="mt-1 text-xs opacity-60">{COACH_COPY.creditPackSubtitle(5)}</p>
            {buying === 5 && (
              <div className="mx-auto mt-2 h-4 w-4 animate-spin rounded-full border-2 border-[rgba(110,65,15,0.3)] border-t-[rgba(110,65,15,0.85)]" />
            )}
          </button>
          <button
            type="button"
            disabled={buying !== null}
            onClick={() => handleBuy(20)}
            className="candy-frame candy-frame-gold min-h-[56px] p-4 text-center disabled:opacity-60"
          >
            <p className="text-lg font-extrabold">{COACH_COPY.creditPack20}</p>
            <p className="text-sm opacity-80">$0.10</p>
            <p className="mt-1 text-xs opacity-65">{COACH_COPY.creditPackSubtitle(20)}</p>
            <span
              className="mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-extrabold uppercase tracking-wide"
              style={{
                background: "rgba(120, 65, 5, 0.85)",
                color: "rgba(255, 240, 180, 0.98)",
              }}
            >
              {COACH_COPY.creditBest}
            </span>
            {buying === 20 && (
              <div className="mx-auto mt-2 h-4 w-4 animate-spin rounded-full border-2 border-[rgba(120,65,5,0.3)] border-t-[rgba(120,65,5,0.85)]" />
            )}
          </button>
        </div>
        {buying && (
          <p
            className="mt-3 text-center text-sm font-semibold animate-in fade-in duration-200"
            style={{ color: "rgba(110, 65, 15, 0.75)" }}
          >
            {COACH_COPY.buyWithUsdc}
          </p>
        )}
        <p className="mt-4 text-center text-xs" style={{ color: "rgba(110, 65, 15, 0.55)" }}>
          <button
            type="button"
            onClick={onQuickReview}
            disabled={buying !== null}
            className="underline hover:opacity-80 disabled:opacity-50"
          >
            {COACH_COPY.orQuickReview}
          </button>
        </p>
      </SheetContent>
    </Sheet>
  );
}
