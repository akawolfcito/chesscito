"use client";

import { useState } from "react";
import { ActionRowIcon } from "@/components/action-row/action-row-icon";
import { StonePedestal } from "@/components/scene-rooted/stone-pedestal";
import { MiniArenaSheet } from "./mini-arena-sheet";
import type { MiniArenaSetup } from "@/lib/game/mini-arena";

type Props = {
  /** Bridge setup to launch when the user taps. */
  setup: MiniArenaSetup;
  /** Render only when the prerequisite is met. The play-hub computes
   *  this from the player's stars on the relevant piece (12+ on
   *  rook → K+R vs K is unlocked). When false the slot renders
   *  nothing — silent gating keeps the header clean. */
  unlocked: boolean;
};

/**
 * Compact entry pedestal that opens the MiniArenaSheet for the given
 * bridge setup. Lives in the action row next to the contextual action
 * pin so the bridge entry point doesn't push the board down.
 */
export function MiniArenaBridgeSlot({ setup, unlocked }: Props) {
  const [open, setOpen] = useState(false);
  if (!unlocked) return null;

  return (
    <>
      <span data-testid="mini-arena-bridge" className="inline-flex">
        <StonePedestal
          stone={4}
          size="large"
          className="action-row-pedestal action-row-pedestal-arena"
          icon={<ActionRowIcon name="battle-espadas" className="h-14 w-14 object-contain" />}
          onClick={() => setOpen(true)}
          aria-label={`Reto avanzado: ${setup.name}`}
        />
      </span>
      <MiniArenaSheet open={open} onOpenChange={setOpen} setup={setup} />
    </>
  );
}
