"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { HubActionTile } from "@/components/hub/hub-action-tile";
import { HubTileStatusChip } from "@/components/hub/hub-tile-status-chip";
import { MiniArenaSheet } from "@/components/mini-arena/mini-arena-sheet";
import type { MiniArenaSetup } from "@/lib/game/mini-arena";

type Props = {
  setup: MiniArenaSetup;
  unlocked: boolean;
};

/** Hub right-rail Special Training tile. Renders as a
 *  `.reward-tile.is-locked` (matches LEARN structure) and opens the
 *  MiniArenaSheet when unlocked. Pre-unlock the tile is HIDDEN
 *  entirely — players reported the previous "visible but disabled"
 *  state as a dead tap on first visit with no affordance explaining
 *  why. Hiding until the rook-mastery threshold (12 stars) lights
 *  it up tracks the same "show after interaction" model the rest
 *  of the action rail uses. */
export function HubArenaTile({ setup, unlocked }: Props) {
  const t = useTranslations("HUB_ACTION_RAIL_COPY");
  const [open, setOpen] = useState(false);

  if (!unlocked) return null;

  return (
    <>
      <div data-testid="mini-arena-trigger" className="contents">
        <HubActionTile
          iconSrc="/art/new-icons-chesscito/training-icon-v1.png"
          label={t("mateLabel")}
          ariaLabel={t("arenaUnlockedAriaFormat", { name: setup.name })}
          onClick={() => setOpen(true)}
          // Mate has no real cooldown yet — static "ready" dot only,
          // no invented logic (founder micro-block 2026-06-11).
          badge={<HubTileStatusChip kind="ready" />}
        />
      </div>
      <MiniArenaSheet open={open} onOpenChange={setOpen} setup={setup} />
    </>
  );
}
