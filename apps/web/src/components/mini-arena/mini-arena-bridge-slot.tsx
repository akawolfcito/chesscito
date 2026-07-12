"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ActionRowIcon } from "@/components/action-row/action-row-icon";
import { PinStatusMarker, type PinStatus } from "@/components/redesign/pin-status-marker";
import { StonePedestal } from "@/components/scene-rooted/stone-pedestal";
import { MiniArenaSheet } from "./mini-arena-sheet";
import { getMiniArenaBest } from "@/lib/game/mini-arena-progress";
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
  /** Controlled open state. Pass BOTH `open` and `onOpenChange` to drive the
   *  sheet from outside — the Special Training celebration does this, so its
   *  primary CTA opens the content it just promised instead of navigating.
   *  Omit both to keep the pedestal self-managed (the default). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/**
 * Compact entry pedestal that opens the MiniArenaSheet for the given
 * bridge setup. Lives in the action row next to the contextual action
 * pin so the bridge entry point doesn't push the board down.
 */
export function MiniArenaBridgeSlot({
  setup,
  unlocked,
  renderLocked = false,
  open: controlledOpen,
  onOpenChange,
}: Props) {
  const t = useTranslations("HUB_ACTION_RAIL_COPY");
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = (next: boolean) => {
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  // Signal hierarchy (Sally pass 2026-06-11): the dot marks NEW
  // content — unlocked but never beaten. Once beaten the marker clears
  // entirely (no done-check): the bridge is a permanent replayable
  // door, not a task. Hydrated post-mount (localStorage).
  const [status, setStatus] = useState<PinStatus | null>(null);
  useEffect(() => {
    if (!unlocked) {
      setStatus(null);
      return;
    }
    setStatus(getMiniArenaBest(setup.id) != null ? null : "pending");
  }, [unlocked, setup.id, open]);
  if (!unlocked && !renderLocked) return null;

  return (
    <>
      <span
        data-testid="mini-arena-bridge"
        className="flex flex-col items-center gap-1"
      >
        <span className="relative inline-flex">
        <StonePedestal
          stone={4}
          size="large"
          className="action-row-pedestal action-row-pedestal-arena"
          icon={
            // Sizing on the IMG, not the inline <picture> — see
            // DailyTacticCard note (44px uniform action-row height).
            <ActionRowIcon
              name="training-icon-v1"
              className="[&>img]:h-11 [&>img]:w-auto [&>img]:max-w-none"
            />
          }
          onClick={() => setOpen(true)}
          disabled={!unlocked}
          aria-label={
            unlocked
              ? t("arenaUnlockedAriaFormat", { name: setup.name })
              : t("arenaLockedAriaFormat", { name: setup.name })
          }
        />
          <PinStatusMarker status={status} />
        </span>
        <span
          aria-hidden="true"
          className="action-pin-label game-label text-nano font-bold uppercase tracking-[0.12em] text-[rgba(63,34,8,0.85)]"
        >
          Training
        </span>
      </span>
      {unlocked ? (
        <MiniArenaSheet open={open} onOpenChange={setOpen} setup={setup} />
      ) : null}
    </>
  );
}
