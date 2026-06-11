"use client";

import { ActionRowIcon } from "@/components/action-row/action-row-icon";
import { PinStatusMarker } from "@/components/redesign/pin-status-marker";
import { StonePedestal } from "@/components/scene-rooted/stone-pedestal";

export type DailyTacticCardProps = {
  /** Short label of the day's puzzle, e.g. "Smothered mate". */
  puzzleName: string;
  /** Current consecutive-day streak. 0 means no streak yet. */
  streak: number;
  /** True when the player already solved today's tactic. */
  isCompletedToday: boolean;
  /** Hours until the next puzzle drops. Used in the completed-state label. */
  hoursUntilNext: number;
  /** Fired when the user taps the pedestal. Suppressed when completed. */
  onPlay: () => void;
};

function formatNextWindow(hours: number): string {
  if (hours <= 0) return "fresh now";
  if (hours < 1) return "fresh in <1h";
  return `fresh in ${Math.floor(hours)}h`;
}

export function DailyTacticCard({
  puzzleName,
  streak,
  isCompletedToday,
  hoursUntilNext,
  onPlay,
}: DailyTacticCardProps) {
  const ariaLabel = isCompletedToday
    ? `Daily Tactic completed. ${formatNextWindow(hoursUntilNext)}.`
    : `Play today's Daily Tactic. ${puzzleName}.`;

  const badge =
    streak > 0 ? (
      <span
        data-testid="daily-tactic-streak"
        className="flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-nano font-extrabold leading-none"
        style={{
          background: isCompletedToday
            ? "rgba(34, 197, 94, 0.92)"
            : "rgba(63, 34, 8, 0.92)",
          color: "rgba(255, 245, 215, 0.98)",
          boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
        }}
        aria-hidden="true"
      >
        {streak}
      </span>
    ) : undefined;

  return (
    <span
      data-testid="daily-tactic-card"
      data-state={isCompletedToday ? "completed" : "pending"}
      className="flex flex-col items-center gap-1"
    >
      <span className="relative inline-flex">
        <StonePedestal
          stone={2}
          size="large"
          className="action-row-pedestal action-row-pedestal-daily"
          icon={
            // 44px uniform sprite height across the action row
            // (founder size pass 2026-06-11). Sizing goes on the IMG:
            // <picture> is inline, so height utilities on it are
            // silently ignored and the sprite rendered oversized.
            <ActionRowIcon
              name="daily-icon-v1"
              className="[&>img]:h-11 [&>img]:w-auto [&>img]:max-w-none"
            />
          }
          badge={badge}
          onClick={onPlay}
          disabled={isCompletedToday}
          aria-label={ariaLabel}
        />
        {/* Signal hierarchy (Sally pass 2026-06-11): the dot marks an
            unopened daily gift. A completed daily retires from the row
            (see DailyTacticSlot), so no done-check is needed here. */}
        {isCompletedToday ? null : <PinStatusMarker status="pending" />}
      </span>
      <span
        aria-hidden="true"
        className="action-pin-label game-label text-nano font-bold uppercase tracking-[0.12em] text-[rgba(63,34,8,0.85)]"
      >
        Daily
      </span>
    </span>
  );
}
