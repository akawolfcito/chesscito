"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export type StonePedestalSize = "small" | "medium" | "large";
export type StonePedestalStone = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type StonePedestalProps = {
  icon: ReactNode;
  stone?: StonePedestalStone;
  size?: StonePedestalSize;
  badge?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  "aria-label": string;
};

export function StonePedestal({
  icon,
  stone = 2,
  size = "medium",
  badge,
  onClick,
  disabled = false,
  loading = false,
  className = "",
  "aria-label": ariaLabel,
}: StonePedestalProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const [isPlaceholder, setIsPlaceholder] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const computed = window.getComputedStyle(node).backgroundImage;
    setIsPlaceholder(!computed || computed === "none" || computed === "");
  }, [stone]);

  const state = loading ? "loading" : disabled ? "disabled" : "default";

  const classes = [
    "stone-pedestal",
    `stone-pedestal-${size}`,
    `stone-pedestal-stone-${stone}`,
    isPlaceholder ? "is-placeholder" : "",
    loading ? "is-loading" : "",
    disabled ? "is-disabled" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const handleClick = () => {
    if (disabled || loading) return;
    onClick();
  };

  return (
    <button
      ref={ref}
      type="button"
      data-component="stone-pedestal"
      data-stone={String(stone)}
      data-size={size}
      data-state={state}
      className={classes}
      disabled={disabled || loading}
      onClick={handleClick}
      aria-label={ariaLabel}
      aria-busy={loading || undefined}
    >
      <span className="stone-pedestal-icon">{icon}</span>
      {badge ? <span className="stone-pedestal-badge">{badge}</span> : null}
      {loading ? (
        <span className="stone-pedestal-spinner" aria-hidden="true" />
      ) : null}
    </button>
  );
}
