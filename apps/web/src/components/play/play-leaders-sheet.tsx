"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { TrophyList } from "@/components/trophies/trophy-list";
import {
  clearOptimisticVictory,
  getOptimisticVictory,
  toVictoryEntry,
  type ApiVictoryRow,
} from "@/components/trophies/trophies-data-provider";
import { getVictoryAddress } from "@/lib/game/victory-events";
import type { VictoryEntry } from "@/lib/game/victory-events";
import { ContextualHeader } from "@/components/ui/contextual-header";
import { TileIconSlot } from "@/components/ui/tile-icon-slot";
import { Sheet, SheetContent } from "@/components/ui/sheet";

type PlayLeadersSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function PlayLeadersBody() {
  const t = useTranslations("PLAY_LEADERS_COPY");
  const [hallOfFame, setHallOfFame] = useState<VictoryEntry[]>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const configured = getVictoryAddress() !== null;

  const load = useCallback(async () => {
    if (!configured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/hall-of-fame");
      if (!res.ok) throw new Error("fetch failed");
      const rows = (await res.json()) as ApiVictoryRow[];
      const entries = rows.map(toVictoryEntry);
      const optimistic = getOptimisticVictory();
      if (optimistic) {
        // Match by tokenId (the specific victory just recorded), not by
        // player — a repeat winner's OTHER prior victories being present
        // in the fetched list must not clear this optimistic entry before
        // /api/hall-of-fame has actually indexed it.
        const found = entries.some((e) => String(e.tokenId) === optimistic.tokenId);
        if (found) clearOptimisticVictory();
        else entries.unshift(toVictoryEntry(optimistic));
      }
      setHallOfFame(entries);
    } catch {
      setError(t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [configured, t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <TrophyList
      victories={hallOfFame}
      loading={loading}
      error={error}
      emptyMessage={t("emptyMessage")}
      variant="hall-of-fame"
      onRetry={() => void load()}
    />
  );
}

/**
 * PlayLeadersSheet — Play mode's dock "leaderboard" destination. Shows the
 * global Arena Hall of Fame (minted victories across all players, via the
 * existing `/api/hall-of-fame` route). No ELO, no durable ranking — victory
 * count only, matching the MVP scope. Never Learn's training leaderboard.
 */
export function PlayLeadersSheet({ open, onOpenChange }: PlayLeadersSheetProps) {
  const t = useTranslations("PLAY_LEADERS_COPY");
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        hideClose
        title={t("pageTitle")}
        description={t("pageDescription")}
        className="mission-shell sheet-bg-leaderboard flex h-[100dvh] flex-col rounded-none border-0 pb-0"
      >
        <div className="shrink-0 -mx-6 -mt-6 border-b border-[rgba(110,65,15,0.30)] pt-[calc(env(safe-area-inset-top)+0.25rem)]">
          <ContextualHeader
            variant="close-control"
            iconSlot={<TileIconSlot src="/art/leaderboard-menu" />}
            title={t("pageTitle")}
            subtitle={t("pageDescription")}
            close={{ onClick: () => onOpenChange(false), label: t("closeSheetLabel") }}
          />
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain mt-6 space-y-6">
          {open ? <PlayLeadersBody /> : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
