"use client";

import { useTranslations } from "next-intl";

import { CandyIcon } from "@/components/redesign/candy-icon";
import { CHESSCITO_LITE_MODE } from "@/lib/feature-flags";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ContextualHeader } from "@/components/ui/contextual-header";
import { TileIconSlot } from "@/components/ui/tile-icon-slot";
import { TrophiesBody, TrophiesHeroBand } from "@/components/trophies/trophies-body";
import { TrophiesDataProvider } from "@/components/trophies/trophies-data-provider";

type TrophiesSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Render the built-in `<SheetTrigger>` dock button. Default `true`
   *  for legacy callers. Pass `false` from surfaces that control open
   *  state externally (e.g. /arena via `?sheet=trophies`) and never
   *  want the orphan trigger floating in the layout tree — without
   *  this gate, Radix renders the button as a real DOM node sibling
   *  of the host and its `h-full w-full` image invades the layout. */
  showTrigger?: boolean;
};

/**
 * TrophiesSheet — dock destination mirroring the BadgeSheet / ShopSheet
 * / LeaderboardSheet pattern: a bottom drawer on top of the hub, not
 * a full-page route. Uses sheet-bg-hub so it shares the tree band +
 * cream wash with the other sheets. Content is the shared TrophiesBody
 * so this sheet and any remaining standalone consumer stay in sync.
 */
export function TrophiesSheet({ open, onOpenChange, showTrigger = true }: TrophiesSheetProps) {
  const tDock = useTranslations("DOCK_LABELS");
  const t = useTranslations("TROPHY_VITRINE_COPY");
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {showTrigger ? (
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label={tDock("trophies")}
            className="relative flex h-full w-full shrink-0 items-center justify-center text-amber-200/80"
          >
            <CandyIcon name="trophy" className="h-full w-full" />
          </button>
        </SheetTrigger>
      ) : null}
      <SheetContent
        side="bottom"
        hideClose
        title={t("pageTitle")}
        description={t(CHESSCITO_LITE_MODE ? "pageDescriptionLite" : "pageDescription")}
        className="mission-shell sheet-bg-hub flex h-[100dvh] flex-col rounded-none border-0 pb-[5rem]"
      >
        <div className="shrink-0 -mx-6 -mt-6 border-b border-[rgba(110,65,15,0.30)] pt-[calc(env(safe-area-inset-top)+0.25rem)]">
          <ContextualHeader
            variant="close-control"
            iconSlot={<TileIconSlot src="/art/action-row/trofeo-epico" />}
            title={t("pageTitle")}
            subtitle={t(CHESSCITO_LITE_MODE ? "pageDescriptionLite" : "pageDescription")}
            close={{ onClick: () => onOpenChange(false), label: t("closeSheetLabel") }}
          />
        </div>
        {/* 2026-05-30: hero band rendered as a sibling OUTSIDE the
         *  scroll container (mirror Badges pattern). The scroll's
         *  `overflow-y-auto` per CSS spec promotes overflow-x to auto
         *  and would clip the anchor's `left: -1.25rem` overhang.
         *  Hoisting the band keeps the trofeo-épico character visibly
         *  escaping the panel + makes the band a persistent overview
         *  header that doesn't scroll off with the detail sections.
         *  `TrophiesDataProvider` wraps both so the hero and the body
         *  share a single `/api/my-victories` fetch. */}
        <TrophiesDataProvider>
          <div className="shrink-0 mt-4">
            <TrophiesHeroBand showAchievements={false} />
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain mt-6 space-y-6">
            <TrophiesBody hideHero showAchievements={false} showHallOfFame={false} />
          </div>
        </TrophiesDataProvider>
      </SheetContent>
    </Sheet>
  );
}
