"use client";

import { DAILY_BADGE_COPY } from "@/lib/content/editorial";

type Props = {
  onPress: () => void;
};

export function DailyBadge({ onPress }: Props) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={DAILY_BADGE_COPY.ariaLabel}
      className="hub-daily-badge"
    >
      <span aria-hidden="true" className="hub-daily-badge-spark">
        ⚡
      </span>
      <span className="hub-daily-badge-label">{DAILY_BADGE_COPY.label}</span>
    </button>
  );
}
