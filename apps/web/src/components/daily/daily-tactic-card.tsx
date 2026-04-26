"use client";

import { CandyIcon } from "@/components/redesign/candy-icon";

export type DailyTacticCardProps = {
  /** Short label of the day's puzzle, e.g. "Smothered mate". */
  puzzleName: string;
  /** Current consecutive-day streak. 0 means no streak yet. */
  streak: number;
  /** True when the player already solved today's tactic. */
  isCompletedToday: boolean;
  /** Hours until the next puzzle drops. Used in the completed state. */
  hoursUntilNext: number;
  /** Fired when the user taps the CTA. Card is interactive only when
   *  not yet completed today. */
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

  const Tag: "button" | "div" = isCompletedToday ? "div" : "button";
  const interactiveProps = isCompletedToday
    ? {}
    : { onClick: onPlay, type: "button" as const, "aria-label": ariaLabel };

  return (
    <Tag
      {...interactiveProps}
      data-testid="daily-tactic-card"
      data-state={isCompletedToday ? "completed" : "pending"}
      className={`candy-frame candy-frame-amber daily-tactic-card flex w-full items-center gap-3 px-4 py-3 text-left ${
        isCompletedToday ? "" : "cursor-pointer"
      }`}
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        style={{
          background: isCompletedToday
            ? "rgba(34, 197, 94, 0.22)"
            : "rgba(245, 158, 11, 0.22)",
          border: `1px solid ${
            isCompletedToday ? "rgba(34, 197, 94, 0.55)" : "rgba(245, 158, 11, 0.55)"
          }`,
        }}
        aria-hidden="true"
      >
        <CandyIcon
          name={isCompletedToday ? "check" : "coach"}
          className="h-6 w-6"
        />
      </span>

      <div className="flex flex-1 flex-col leading-tight">
        <span className="text-nano font-bold uppercase tracking-[0.14em] opacity-80">
          Daily Tactic
        </span>
        <span className="text-sm font-extrabold">
          {isCompletedToday ? "Solved!" : puzzleName}
        </span>
        <span className="text-xs opacity-80">
          {isCompletedToday
            ? formatNextWindow(hoursUntilNext)
            : streak > 0
              ? `Streak: ${streak} day${streak === 1 ? "" : "s"}`
              : "Start your streak — 30 seconds"}
        </span>
      </div>

      {!isCompletedToday && (
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
      )}

      {isCompletedToday && streak > 0 && (
        <span
          className="flex flex-col items-center rounded-xl px-3 py-1.5 leading-none"
          style={{
            background: "rgba(34, 197, 94, 0.85)",
            color: "rgba(8, 32, 16, 0.98)",
            boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.20)",
          }}
        >
          <span className="text-base font-extrabold">{streak}</span>
          <span className="text-nano font-bold uppercase tracking-[0.12em]">
            {streak === 1 ? "day" : "days"}
          </span>
        </span>
      )}
    </Tag>
  );
}
