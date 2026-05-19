"use client";

import { useState } from "react";

import { HubActionTile } from "@/components/hub/hub-action-tile";
import { MiniArenaSheet } from "@/components/mini-arena/mini-arena-sheet";
import type { MiniArenaSetup } from "@/lib/game/mini-arena";

type Props = {
  setup: MiniArenaSetup;
  unlocked: boolean;
};

/** Hub right-rail Special Training tile. Renders as a
 *  `.reward-tile.is-locked` (matches LEARN structure) and opens the
 *  MiniArenaSheet when unlocked. Locked variant disables interaction
 *  so players see the upcoming reward without dead-ending. */
export function HubArenaTile({ setup, unlocked }: Props) {
  const [open, setOpen] = useState(false);
  const ariaLabel = unlocked
    ? `Special training: ${setup.name}`
    : `${setup.name} — locked`;

  return (
    <>
      <HubActionTile
        iconSrc="/art/new-icons-chesscito/learning.png"
        label="Arena"
        ariaLabel={ariaLabel}
        onClick={() => unlocked && setOpen(true)}
        disabled={!unlocked}
      />
      {unlocked ? (
        <MiniArenaSheet open={open} onOpenChange={setOpen} setup={setup} />
      ) : null}
    </>
  );
}
