"use client";

import type { ReactNode } from "react";

import { HubActionTile } from "@/components/hub/hub-action-tile";
import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";
import type { ThemeAssetKey } from "@/lib/themes/theme-registry";

export type HubDailyTriggerVariant = "tile" | "corner-icon";

export type HubDailyTriggerProps = {
  variant: HubDailyTriggerVariant;
  /** Daily tile icon (tile variant only; corner-icon uses the gift glyph). */
  iconSlot?: ThemeAssetKey;
  /** Legacy escape hatch for non-catalog fixtures. Runtime callers use iconSlot. */
  iconSrc?: string;
  label: string;
  ariaLabel: string;
  onClick: () => void;
  disabled?: boolean;
  /** The daily was earned today. Corner variant renders a trophy-like
   *  confirmation instead of making the gift look unavailable. */
  completed?: boolean;
  /** Streak / notif badge — rendered in both variants, positioned by CSS. */
  badge?: ReactNode;
};

/** Daily Tactic trigger. Two presentations sharing one tap surface:
 *
 *  - `tile` (default for the Full hub right-rail) → the existing
 *    `HubActionTile` (byte-identical: same icon dims, priority, label).
 *  - `corner-icon` (Learn hub, P1-B) → a compact top-right gift glyph + badge.
 *    Reuses the canonical `shop/welcome-gift` asset; no new art.
 *
 *  This component is the ONLY thing that changes between variants — the daily
 *  state machine, the `DailyTacticSheet`, and the welcome-package overlays all
 *  stay in `HubDailyTile`, so no logic forks. */
export function HubDailyTrigger({
  variant,
  iconSlot,
  iconSrc,
  label,
  ariaLabel,
  onClick,
  disabled = false,
  completed = false,
  badge,
}: HubDailyTriggerProps) {
  if (variant === "corner-icon") {
    return (
      <button
        type="button"
        className="hub-daily-corner"
        data-testid="hub-daily-corner-icon"
        data-state={completed ? "completed" : "pending"}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={onClick}
      >
        {/* eslint-disable-next-line jsx-a11y/aria-unsupported-elements */}
        <ThemeAssetPicture
          slot="shared.welcome-gift"
          pictureClassName="hub-daily-corner-icon"
          alt=""
          aria-hidden="true"
          sizes="52px"
          draggable={false}
        />
        {completed ? (
          <span
            className="reward-tile-notif-streak hub-daily-corner-complete"
            data-state="completed"
            data-testid="hub-daily-complete-check"
            aria-hidden="true"
          >
            ✓
          </span>
        ) : (
          badge
        )}
      </button>
    );
  }

  return (
    <HubActionTile
      iconSlot={iconSlot}
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
