"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export type GemBadgeProps = {
  icon: ReactNode;
  value: ReactNode;
  className?: string;
};

export type GemButtonProps = {
  icon: ReactNode;
  value: ReactNode;
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

export function GemBadge({ icon, value, className = "" }: GemBadgeProps) {
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
    <span ref={ref} data-component="gem-badge" className={classes}>
      <span className="gem-badge-icon">{icon}</span>
      <span className="gem-badge-value">{value}</span>
    </span>
  );
}

export function GemButton({
  icon,
  value,
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
