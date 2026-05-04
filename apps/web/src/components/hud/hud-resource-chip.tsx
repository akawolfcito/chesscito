"use client";

import { useEffect, useRef, useState } from "react";

import { CandyIcon, type CandyIconName } from "@/components/redesign/candy-icon";

export type HudResourceTone = "default" | "pro" | "trophy";
export type HudResourceSize = "md" | "compact";

type Props = {
  /** Display value. Numbers and strings render as-is. `null` / `undefined`
   *  causes the chip to return `null` so the parent collapses cleanly. */
  value: number | string | null | undefined;
  /** Required. Parent supplies a formatted string from `editorial.ts.HUD_COPY`
   *  (e.g. `HUD_COPY.trophiesAriaLabel(15)`). */
  ariaLabel: string;
  /** Visual + default-icon variant. `"default"` requires the `icon` prop. */
  tone?: HudResourceTone;
  size?: HudResourceSize;
  /** Override the chip icon. Required when `tone="default"`. */
  icon?: CandyIconName;
  /** Optional tap target. When present the chip renders as `<button>`;
   *  otherwise as `<span>`. */
  onClick?: () => void;
  className?: string;
};

const TONE_DEFAULT_ICON: Partial<Record<HudResourceTone, CandyIconName>> = {
  trophy: "trophy",
  pro: "crown",
};

const PULSE_DURATION_MS = 240;

/** Persistent HUD pill rendering one Chesscito-native resource. Adventure
 *  primitive — the cream backplate, warm border, and 240ms pulse on value
 *  updates live in `globals.css` (`.hud-resource-chip` + modifiers). The
 *  chip is presentational and accepts the formatted aria-label from the
 *  parent (single-source rule: copy lives in `editorial.ts.HUD_COPY`). */
export function HudResourceChip({
  value,
  ariaLabel,
  tone = "default",
  size = "md",
  icon,
  onClick,
  className = "",
}: Props) {
  const [pulsing, setPulsing] = useState(false);
  const previousValueRef = useRef(value);

  useEffect(() => {
    if (previousValueRef.current === value) {
      return;
    }
    previousValueRef.current = value;
    setPulsing(true);
    const id = window.setTimeout(() => setPulsing(false), PULSE_DURATION_MS);
    return () => window.clearTimeout(id);
  }, [value]);

  if (value === null || value === undefined) {
    return null;
  }

  const resolvedIcon = icon ?? TONE_DEFAULT_ICON[tone];
  const classes = [
    "hud-resource-chip",
    `hud-resource-chip--${tone}`,
    `hud-resource-chip--${size}`,
    pulsing ? "is-pulse" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      {resolvedIcon ? (
        <CandyIcon name={resolvedIcon} className="hud-resource-chip-icon" />
      ) : null}
      <span className="hud-resource-chip-value">{value}</span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        aria-live="polite"
        className={classes}
      >
        {content}
      </button>
    );
  }

  return (
    <span
      role="status"
      aria-label={ariaLabel}
      aria-live="polite"
      className={classes}
    >
      {content}
    </span>
  );
}
