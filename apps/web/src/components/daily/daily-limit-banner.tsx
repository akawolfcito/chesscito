"use client";

import { useEffect, useState } from "react";
import { hoursUntilNextUtcDay } from "@/lib/hub/tile-availability";

type Props = {
  isHardMax: boolean;
  onBack: () => void;
};

function formatCountdown(hours: number): string {
  if (hours >= 12) return "Tomorrow";
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  return `${h}h ${m}m`;
}

export function DailyLimitBanner({ isHardMax, onBack }: Props) {
  const [countdownLabel, setCountdownLabel] = useState<string | null>(null);

  useEffect(() => {
    setCountdownLabel(formatCountdown(hoursUntilNextUtcDay()));
  }, []);

  if (isHardMax) {
    return (
      <div className="daily-limit-banner daily-limit-banner--hard" role="status">
        <p className="daily-limit-banner-heading">That&apos;s enough focus for today.</p>
        <p className="daily-limit-banner-sub">Come back tomorrow.</p>
        <button type="button" onClick={onBack} className="daily-limit-banner-back">
          Back to Hub
        </button>
      </div>
    );
  }

  return (
    <div className="daily-limit-banner" role="status">
      <p className="daily-limit-banner-heading">Great focus today.</p>
      {countdownLabel && (
        <p className="daily-limit-banner-sub">
          More opens in {countdownLabel}
        </p>
      )}
      <div className="daily-limit-banner-actions">
        <button type="button" onClick={onBack} className="daily-limit-banner-back">
          Back to Hub
        </button>
        <button
          type="button"
          disabled
          className="daily-limit-banner-unlock"
          aria-label="Unlock 5 more today"
        >
          Unlock 5 more today
        </button>
      </div>
    </div>
  );
}
