"use client";

import type { ReactNode } from "react";

import { HubActionTile } from "@/components/hub/hub-action-tile";

export type HubDailyTriggerVariant = "tile" | "corner-icon";

export type HubDailyTriggerProps = {
  variant: HubDailyTriggerVariant;
  /** Daily tile icon (tile variant only; corner-icon uses the gift glyph). */
  iconSrc: string;
  label: string;
  ariaLabel: string;
  onClick: () => void;
  disabled?: boolean;
  /** Streak / notif badge — rendered in both variants, positioned by CSS. */
  badge?: ReactNode;
};

/** Daily Tactic trigger. Two presentations sharing one tap surface:
 *
 *  - `tile` (default for the Full hub right-rail) → the existing
 *    `HubActionTile` (byte-identical: same icon dims, priority, label).
 *  - `corner-icon` (Lite hub, P1-B) → a compact top-right gift glyph + badge.
 *    Reuses the canonical `shop/welcome-gift` asset; no new art.
 *
 *  This component is the ONLY thing that changes between variants — the daily
 *  state machine, the `DailyTacticSheet`, and the welcome-package overlays all
 *  stay in `HubDailyTile`, so no logic forks. */
export function HubDailyTrigger({
  variant,
  iconSrc,
  label,
  ariaLabel,
  onClick,
  disabled = false,
  badge,
}: HubDailyTriggerProps) {
  if (variant === "corner-icon") {
    return (
      <button
        type="button"
        className="hub-daily-corner"
        data-testid="hub-daily-corner-icon"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={onClick}
      >
        {/* eslint-disable-next-line jsx-a11y/aria-unsupported-elements */}
        <picture className="hub-daily-corner-icon">
          <source srcSet="/art/shop/welcome-gift.avif" type="image/avif" />
          <source srcSet="/art/shop/welcome-gift.webp" type="image/webp" />
          <img src="/art/shop/welcome-gift.png" alt="" aria-hidden="true" draggable={false} />
        </picture>
        {badge}
      </button>
    );
  }

  return (
    <HubActionTile
      iconSrc={iconSrc}
      label={label}
      ariaLabel={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      badge={badge}
      priority
      iconWidth={228}
      iconHeight={256}
    />
  );
}
