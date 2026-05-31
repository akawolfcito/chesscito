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
  /** When true, the slot still renders while locked, as a disabled
   *  pedestal so the player sees the upcoming reward and what to
   *  earn. Surfaces like the Hub right rail use this so the
   *  vertical stack stays visually stable across unlock thresholds. */
  renderLocked?: boolean;
};

/**
 * Compact entry pedestal that opens the MiniArenaSheet for the given
 * bridge setup. Lives in the action row next to the contextual action
 * pin so the bridge entry point doesn't push the board down.
 */
export function MiniArenaBridgeSlot({ setup, unlocked, renderLocked = false }: Props) {
  const [open, setOpen] = useState(false);
  if (!unlocked && !renderLocked) return null;

  return (
    <>
      <span data-testid="mini-arena-bridge" className="inline-flex">
        <StonePedestal
          stone={4}
          size="large"
          className="action-row-pedestal action-row-pedestal-arena"
          icon={<ActionRowIcon name="play-chess" className="h-14 w-14 object-contain" />}
          onClick={() => setOpen(true)}
          disabled={!unlocked}
          aria-label={unlocked ? `Reto avanzado: ${setup.name}` : `${setup.name}: locked`}
        />
      </span>
      {unlocked ? (
        <MiniArenaSheet open={open} onOpenChange={setOpen} setup={setup} />
      ) : null}
    </>
  );
}
