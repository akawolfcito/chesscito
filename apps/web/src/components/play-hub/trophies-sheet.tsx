"use client";

import Link from "next/link";
import { CandyIcon } from "@/components/redesign/candy-icon";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { TrophiesBody } from "@/components/trophies/trophies-body";
import { ABOUT_LINK_COPY, DOCK_LABELS, TROPHY_VITRINE_COPY } from "@/lib/content/editorial";

type TrophiesSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * TrophiesSheet — dock destination mirroring the BadgeSheet / ShopSheet
 * / LeaderboardSheet pattern: a bottom drawer on top of the hub, not
 * a full-page route. Uses sheet-bg-hub so it shares the tree band +
 * cream wash with the other sheets. Content is the shared TrophiesBody
 * so this sheet and any remaining standalone consumer stay in sync.
 */
export function TrophiesSheet({ open, onOpenChange }: TrophiesSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label={DOCK_LABELS.trophies}
          className="relative flex h-full w-full shrink-0 items-center justify-center text-amber-200/80"
        >
          <CandyIcon name="trophy" className="h-full w-full" />
        </button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="mission-shell sheet-bg-hub flex h-[100dvh] flex-col rounded-none border-0 pb-[5rem]"
      >
        <div className="shrink-0 border-b border-[rgba(110,65,15,0.30)] -mx-6 -mt-6 rounded-none px-6 pb-5 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
          <SheetHeader>
            <SheetTitle
              className="fantasy-title flex items-center gap-2"
              style={{
                color: "rgba(110, 65, 15, 0.95)",
                textShadow: "0 1px 0 rgba(255, 245, 215, 0.80)",
              }}
            >
              <CandyIcon name="trophy" className="h-5 w-5" />
              {TROPHY_VITRINE_COPY.pageTitle}
            </SheetTitle>
            <SheetDescription style={{ color: "rgba(110, 65, 15, 0.70)" }}>
              {TROPHY_VITRINE_COPY.pageDescription}
            </SheetDescription>
          </SheetHeader>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain mt-4 space-y-6">
          <TrophiesBody />
        </div>
        <div className="shrink-0">
          <Link
            href="/about"
            onClick={() => onOpenChange(false)}
            className="mt-3 block text-center text-xs transition-colors hover:opacity-80"
            style={{ color: "rgba(110, 65, 15, 0.65)" }}
          >
            {ABOUT_LINK_COPY.label}
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
