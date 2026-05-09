"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { TreasureTile } from "@/components/scene-rooted/treasure-tile";
import { COACH_COPY } from "@/lib/content/editorial";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBuy: (pack: 5 | 20) => void;
  onQuickReview: () => void;
};

const PACK_PRICE: Record<5 | 20, string> = {
  5: "$0.05",
  20: "$0.10",
};

function CoinStack({ count }: { count: number }) {
  return (
    <span
      className="flex flex-col items-center gap-0.5 leading-none"
      aria-hidden="true"
    >
      <span className="text-2xl">🪙</span>
      <span className="text-base font-extrabold drop-shadow-[0_1px_0_rgba(0,0,0,0.45)]">
        ×{count}
      </span>
    </span>
  );
}

export function CoachPaywall({
  open,
  onOpenChange,
  onBuy,
  onQuickReview,
}: Props) {
  const [buying, setBuying] = useState<5 | 20 | null>(null);

  function handleBuy(pack: 5 | 20) {
    setBuying(pack);
    onBuy(pack);
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!buying) onOpenChange(v);
      }}
    >
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

        <div className="mt-6 grid grid-cols-2 place-items-center gap-3">
          <div className="flex flex-col items-center gap-2">
            <TreasureTile
              size="small"
              iconStack={<CoinStack count={5} />}
              valueChip={PACK_PRICE[5]}
              onClick={() => handleBuy(5)}
              loading={buying === 5}
              disabled={buying !== null && buying !== 5}
              aria-label={`Buy ${COACH_COPY.creditPack5} for ${PACK_PRICE[5]}`}
            />
            <p
              className="text-xs font-semibold opacity-75"
              style={{ color: "rgba(110, 65, 15, 0.85)" }}
            >
              {COACH_COPY.creditPackSubtitle(5)}
            </p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <TreasureTile
              size="large"
              iconStack={<CoinStack count={20} />}
              valueChip={PACK_PRICE[20]}
              ribbon="BEST"
              onClick={() => handleBuy(20)}
              loading={buying === 20}
              disabled={buying !== null && buying !== 20}
              aria-label={`Buy ${COACH_COPY.creditPack20} for ${PACK_PRICE[20]}`}
            />
            <p
              className="text-xs font-semibold opacity-80"
              style={{ color: "rgba(110, 65, 15, 0.85)" }}
            >
              {COACH_COPY.creditPackSubtitle(20)}
            </p>
          </div>
        </div>

        {buying && (
          <p
            className="mt-3 text-center text-sm font-semibold animate-in fade-in duration-200"
            style={{ color: "rgba(110, 65, 15, 0.75)" }}
          >
            {COACH_COPY.buyWithUsdc}
          </p>
        )}

        <p
          className="mt-4 text-center text-xs"
          style={{ color: "rgba(110, 65, 15, 0.55)" }}
        >
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
