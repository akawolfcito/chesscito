"use client";

import { useEffect, useState } from "react";

import { hoursUntilNextUtcDay } from "@/lib/hub/tile-availability";

type Props = {
  isHardMax: boolean;
  onBack: () => void;
};

const ACK_PREFIX = "chesscito:daily-limit-ack:";

/** UTC day key (YYYY-MM-DD). The quota resets at the next UTC day, so the
 *  card is acknowledged per-day: it pops once when the limit is first hit
 *  that day and stays dismissed until the quota resets. */
function utcDayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function formatCountdown(hours: number): string {
  if (hours >= 12) return "Tomorrow";
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  return `${h}h ${m}m`;
}

const BROWN_TEXT = {
  color: "rgba(63, 34, 8, 0.95)",
  textShadow: "0 1px 0 rgba(255, 245, 215, 0.7)",
} as const;

const BROWN_HINT = {
  color: "rgba(110, 65, 15, 0.78)",
  textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
} as const;

export function DailyLimitBanner({ isHardMax, onBack }: Props) {
  const [countdownLabel, setCountdownLabel] = useState<string | null>(null);
  // Starts dismissed during SSR/first paint; the effect decides whether the
  // card should appear for this UTC day. This keeps the card one-shot and
  // never re-pops once acknowledged, so the screen behind it stays usable.
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setCountdownLabel(formatCountdown(hoursUntilNextUtcDay()));
    try {
      const acked = window.localStorage.getItem(ACK_PREFIX + utcDayKey());
      setDismissed(acked === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  function acknowledge() {
    try {
      window.localStorage.setItem(ACK_PREFIX + utcDayKey(), "1");
    } catch {
      // ignore storage failures — in-memory `dismissed` still suppresses
    }
    setDismissed(true);
  }

  if (dismissed) return null;

  const heading = isHardMax
    ? "That's enough focus for today."
    : "Great focus today!";

  // Plain reminder line (not a chip): when more exercises open up.
  const reminder = isHardMax
    ? "More tomorrow"
    : countdownLabel
      ? countdownLabel === "Tomorrow"
        ? "More tomorrow"
        : `More in ${countdownLabel}`
      : null;

  return (
    /* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
    <div
      className="fixed inset-0 z-40 flex items-center justify-center candy-modal-scrim animate-in fade-in duration-300"
      role="dialog"
      aria-modal="true"
      aria-label={heading}
      onClick={acknowledge}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        className="relative mx-4 w-full max-w-[340px] overflow-hidden rounded-[20px] shadow-[0_18px_40px_rgba(0,0,0,0.45)] animate-in zoom-in-95 slide-in-from-bottom-4 duration-400"
        style={{ aspectRatio: "1024 / 662" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Wolf-mage wallpaper carries the green frame + cream copy zone. */}
        <picture>
          <source srcSet="/art/bg-sesion-great.avif" type="image/avif" />
          <source srcSet="/art/bg-sesion-great.webp" type="image/webp" />
          <img
            src="/art/bg-sesion-great.png"
            alt=""
            aria-hidden="true"
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </picture>

        {/* Reused red close asset — closes only, you can keep practicing
            completed exercises behind it. */}
        <button
          type="button"
          onClick={acknowledge}
          aria-label="Close"
          className="candy-close-asset-button absolute right-[3%] top-[5%] z-10"
        >
          <picture>
            <source
              srcSet="/art/screen-mission/close-icon.avif"
              type="image/avif"
            />
            <source
              srcSet="/art/screen-mission/close-icon.webp"
              type="image/webp"
            />
            <img
              src="/art/screen-mission/close-icon.png"
              alt=""
              aria-hidden="true"
              className="h-9 w-9 object-contain"
              draggable={false}
            />
          </picture>
        </button>

        {/* Copy + CTA centered over the card. Title sits below the CTA so it
            lands on the clear lower cream band (best legibility) instead of
            over the wolf. */}
        {/* Title — upper-right zone, over the landscape, clear of the wolf. */}
        <div className="absolute right-[10%] top-[12%] flex h-[42%] w-[56%] items-center justify-center px-[2%] text-center">
          <p
            className="fantasy-title text-2xl font-extrabold leading-snug"
            style={BROWN_TEXT}
          >
            {heading}
          </p>
        </div>

        {/* Reminder + CTA — bottom, centered across the full banner. */}
        <div className="absolute inset-x-0 bottom-[8%] flex flex-col items-center gap-2 px-[6%] text-center">
          {reminder && (
            <p
              className="fantasy-title text-sm font-semibold"
              style={BROWN_HINT}
            >
              {reminder}
            </p>
          )}
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to Hub"
            className="arena-result-secondary-action !text-sm"
          >
            Back to Hub
          </button>
        </div>
      </div>
    </div>
  );
}
