"use client";

import { useState } from "react";
import { CandyIcon } from "@/components/redesign/candy-icon";
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
 * Compact entry pill that opens the MiniArenaSheet for the given
 * bridge setup. Designed to live in the Play Hub headerSlot under
 * the Daily Tactic card so the player sees a clear next step after
 * mastering a piece, without giving up vertical space when the
 * prerequisite isn't yet met.
 */
export function MiniArenaBridgeSlot({ setup, unlocked }: Props) {
  const [open, setOpen] = useState(false);
  if (!unlocked) return null;

  return (
    <>
      <button
        type="button"
        data-testid="mini-arena-bridge"
        onClick={() => setOpen(true)}
        className="candy-frame candy-frame-amber flex w-full items-center gap-3 px-4 py-2.5 text-left"
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
          style={{
            background: "rgba(245, 158, 11, 0.22)",
            border: "1px solid rgba(245, 158, 11, 0.55)",
          }}
          aria-hidden="true"
        >
          <CandyIcon name="trophy" className="h-5 w-5" />
        </span>
        <div className="flex flex-1 flex-col leading-tight">
          <span className="text-nano font-bold uppercase tracking-[0.14em] opacity-80">
            Reto avanzado
          </span>
          <span className="text-sm font-extrabold">{setup.name}</span>
        </div>
        <span
          className="rounded-full px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide"
          style={{
            background: "rgba(63, 34, 8, 0.85)",
            color: "rgba(255, 245, 215, 0.98)",
            boxShadow: "inset 0 1px 0 rgba(255, 245, 215, 0.18)",
          }}
        >
          Play
        </span>
      </button>
      <MiniArenaSheet open={open} onOpenChange={setOpen} setup={setup} />
    </>
  );
}
