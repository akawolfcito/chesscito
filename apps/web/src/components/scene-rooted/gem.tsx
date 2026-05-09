"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Visual register for the gem.
 *
 * - `default` — base purple gem asset (kingdom canon)
 * - `success` — emerald hue (ACTIVE entitlement, OWNED items)
 * - `warning` — amber hue (EXPIRING entitlement, attention)
 * - `locked` — grayscale (locked/unattainable state)
 *
 * Implementation: CSS filter on the [data-tone] selector. Single
 * underlying asset, runtime hue rotation — no new assets required.
 */
export type GemTone = "default" | "success" | "warning" | "locked";

export type GemBadgeProps = {
  icon: ReactNode;
  value: ReactNode;
  tone?: GemTone;
  className?: string;
};

export type GemButtonProps = {
  icon: ReactNode;
  value: ReactNode;
  tone?: GemTone;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  "aria-label": string;
};

function usePlaceholderProbe<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [isPlaceholder, setIsPlaceholder] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const computed = window.getComputedStyle(node).backgroundImage;
    setIsPlaceholder(!computed || computed === "none" || computed === "");
  }, []);
  return [ref, isPlaceholder] as const;
}

export function GemBadge({
  icon,
  value,
  tone = "default",
  className = "",
}: GemBadgeProps) {
  const [ref, isPlaceholder] = usePlaceholderProbe<HTMLSpanElement>();

  const classes = [
    "gem-badge",
    isPlaceholder ? "is-placeholder" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    <span
      ref={ref}
      data-component="gem-badge"
      data-tone={tone}
      className={classes}
    >
      <span className="gem-badge-icon">{icon}</span>
      <span className="gem-badge-value">{value}</span>
    </span>
  );
}

export function GemButton({
  icon,
  value,
  tone = "default",
  onClick,
  disabled = false,
  className = "",
  "aria-label": ariaLabel,
}: GemButtonProps) {
  const [ref, isPlaceholder] = usePlaceholderProbe<HTMLButtonElement>();

  const state = disabled ? "disabled" : "default";

  const classes = [
    "gem-button",
    isPlaceholder ? "is-placeholder" : "",
    disabled ? "is-disabled" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const handleClick = () => {
    if (disabled) return;
    onClick();
  };

  return (
    <button
      ref={ref}
      type="button"
      data-component="gem-button"
      data-state={state}
      data-tone={tone}
      className={classes}
      disabled={disabled}
      onClick={handleClick}
      aria-label={ariaLabel}
    >
      <span className="gem-button-icon">{icon}</span>
      <span className="gem-button-value">{value}</span>
    </button>
  );
}
