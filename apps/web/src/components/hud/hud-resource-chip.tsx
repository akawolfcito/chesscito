"use client";

import { useEffect, useRef, useState } from "react";

import { CandyIcon, type CandyIconName } from "@/components/redesign/candy-icon";

export type HudResourceTone = "default" | "pro" | "trophy";
export type HudResourceSize = "md" | "compact";
export type Atmosphere = "adventure" | "scholarly";

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
  /** Visual register. Adventure (default) = warm-cream Adventure pill;
   *  Scholarly = warm-paper backplate for Scholarly surfaces. */
  atmosphere?: Atmosphere;
  /** Override the chip icon. Required when `tone="default"`. */
  icon?: CandyIconName;
  imageIconSrc?: string;
  /** Optional tap target. When present the chip renders as `<button>`;
   *  otherwise as `<span>`. */
  onClick?: () => void;
  className?: string;
  /** When true and `value` is a number that decremented vs the
   *  previous render, the chip applies the `is-pulse-damage` class
   *  for 250ms instead of the default `is-pulse`. Used by the
   *  shields chip to telegraph "shield used" (spec section 3.5 —
   *  damaged-shield sprite swap analogue, CSS-only until the sprite
   *  asset ships). No-op for non-numeric values. */
  pulseDamageOnDecrement?: boolean;
};

const TONE_DEFAULT_ICON: Partial<Record<HudResourceTone, CandyIconName>> = {
  trophy: "trophy",
  pro: "crown",
};

const PULSE_DURATION_MS = 240;
const DAMAGE_PULSE_DURATION_MS = 250;

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
  atmosphere = "adventure",
  icon,
  imageIconSrc,
  onClick,
  className = "",
  pulseDamageOnDecrement = false,
}: Props) {
  const [pulsing, setPulsing] = useState(false);
  const [damagePulsing, setDamagePulsing] = useState(false);
  const previousValueRef = useRef(value);

  useEffect(() => {
    const prev = previousValueRef.current;
    if (prev === value) {
      return;
    }
    previousValueRef.current = value;

    // Damage variant: numeric value decreased AND caller opted in.
    // Tells the user "shield used" (spec section 3.5). Visually
    // overrides the default pulse so we don't double-animate.
    const isDecrement =
      pulseDamageOnDecrement &&
      typeof prev === "number" &&
      typeof value === "number" &&
      value < prev;

    if (isDecrement) {
      setDamagePulsing(true);
      const id = window.setTimeout(
        () => setDamagePulsing(false),
        DAMAGE_PULSE_DURATION_MS,
      );
      return () => window.clearTimeout(id);
    }

    setPulsing(true);
    const id = window.setTimeout(() => setPulsing(false), PULSE_DURATION_MS);
    return () => window.clearTimeout(id);
  }, [value, pulseDamageOnDecrement]);

  if (value === null || value === undefined) {
    return null;
  }

  const resolvedIcon = icon ?? TONE_DEFAULT_ICON[tone];
  const classes = [
    "hud-resource-chip",
    `hud-resource-chip--${tone}`,
    `hud-resource-chip--${size}`,
    `is-atmosphere-${atmosphere}`,
    damagePulsing ? "is-pulse-damage" : pulsing ? "is-pulse" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      {imageIconSrc ? (
        <img
          src={imageIconSrc}
          alt=""
          aria-hidden="true"
          className="hud-resource-chip-icon"
          draggable={false}
        />
      ) : resolvedIcon ? (
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
