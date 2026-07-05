"use client";

import { useTranslations } from "next-intl";

import { AchievementsGrid } from "@/components/trophies/achievements-grid";
import { TrophiesDataProvider, useTrophiesData } from "@/components/trophies/trophies-data-provider";
import { computeAchievements } from "@/lib/achievements/compute";
import { ContextualHeader } from "@/components/ui/contextual-header";
import { TileIconSlot } from "@/components/ui/tile-icon-slot";
import { Sheet, SheetContent } from "@/components/ui/sheet";

type PlayBadgesSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function PlayBadgesBody() {
  const { victories } = useTrophiesData();
  const summary = computeAchievements(victories);
  return <AchievementsGrid achievements={summary.list} />;
}

/**
 * PlayBadgesSheet — Play mode's dock "badge" destination. Renders the 7
 * competitive achievements derived from Victory NFTs (`computeAchievements`),
 * the same derivation TrophiesBody already uses for non-Learn achievements.
 * Never renders Learn's piece badges (`BadgeSheet`).
 */
export function PlayBadgesSheet({ open, onOpenChange }: PlayBadgesSheetProps) {
  const t = useTranslations("PLAY_BADGES_COPY");
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        hideClose
        title={t("pageTitle")}
        description={t("pageDescription")}
        className="mission-shell sheet-bg-hub flex h-[100dvh] flex-col rounded-none border-0 pb-[5rem]"
      >
        <div className="shrink-0 -mx-6 -mt-6 border-b border-[rgba(110,65,15,0.30)] pt-[calc(env(safe-area-inset-top)+0.25rem)]">
          <ContextualHeader
            variant="close-control"
            iconSlot={<TileIconSlot src="/art/badge-menu" />}
            title={t("pageTitle")}
            subtitle={t("pageDescription")}
            close={{ onClick: () => onOpenChange(false), label: t("closeSheetLabel") }}
          />
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain mt-6">
          {open ? (
            <TrophiesDataProvider>
              <PlayBadgesBody />
            </TrophiesDataProvider>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
