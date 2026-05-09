"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export type TreasureTileSize = "small" | "large";
export type TreasureTileRibbon = "BEST" | "NEW" | "SALE";

export type TreasureTileProps = {
  size: TreasureTileSize;
  iconStack: ReactNode;
  valueChip?: ReactNode;
  ribbon?: TreasureTileRibbon;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  "aria-label": string;
};

export function TreasureTile({
  size,
  iconStack,
  valueChip,
  ribbon,
  onClick,
  disabled = false,
  loading = false,
  className = "",
  "aria-label": ariaLabel,
}: TreasureTileProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const [isPlaceholder, setIsPlaceholder] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const computed = window.getComputedStyle(node).backgroundImage;
    setIsPlaceholder(!computed || computed === "none" || computed === "");
  }, [size]);

  const state = loading ? "loading" : disabled ? "disabled" : "default";

  const classes = [
    "treasure-tile",
    `treasure-tile-${size}`,
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
      data-component="treasure-tile"
      data-size={size}
      data-state={state}
      className={classes}
      disabled={disabled || loading}
      onClick={handleClick}
      aria-label={ariaLabel}
      aria-busy={loading || undefined}
    >
      <span className="treasure-tile-icon-stack">{iconStack}</span>
      {valueChip ? (
        <span className="treasure-tile-value-chip">{valueChip}</span>
      ) : null}
      {ribbon ? (
        <span className="treasure-tile-ribbon" data-ribbon={ribbon}>
          {ribbon}
        </span>
      ) : null}
      {loading ? (
        <span className="treasure-tile-spinner" aria-hidden="true" />
      ) : null}
    </button>
  );
}
