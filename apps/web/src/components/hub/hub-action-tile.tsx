"use client";

import type { ReactNode } from "react";

type Props = {
  iconSrc: string;
  label: string;
  ariaLabel: string;
  onClick: () => void;
  disabled?: boolean;
  /** Optional decoration rendered on top of the tile (e.g. streak badge,
   *  lock icon, notification pip). Positioned by the parent CSS. */
  badge?: ReactNode;
  /** When true, hints the browser to fetch the icon with high priority
   *  via `fetchPriority="high"`. Opt-in per-tile — only the LCP
   *  candidate (Daily Tactic) should set this. Defaults to false. */
  priority?: boolean;
  /** Intrinsic width of the icon asset in pixels. Used as the `<img>`
   *  width attribute so the browser reserves layout space at HTML parse
   *  time. Pair with `iconHeight` to enable. */
  iconWidth?: number;
  /** Intrinsic height of the icon asset in pixels. See `iconWidth`. */
  iconHeight?: number;
  className?: string;
};

/** Hub right-rail tile. Mirrors `.reward-tile.is-locked` exactly so the
 *  right rail reads as a structural sibling of the LEARN rail — same
 *  60×60 silhouette, same locked-piece stone backplate, same piece +
 *  label layout. Icon source PNGs are tall-aspect by design; the
 *  `.reward-tile-piece` container clamps them to 38×42 with
 *  `object-fit: contain` exactly like the LEARN piece images. */
export function HubActionTile({
  iconSrc,
  label,
  ariaLabel,
  onClick,
  disabled = false,
  badge,
  priority = false,
  iconWidth,
  iconHeight,
  className = "",
}: Props) {
  const dimAttrs =
    iconWidth !== undefined && iconHeight !== undefined
      ? { width: iconWidth, height: iconHeight }
      : {};
  const priorityAttrs = priority ? { fetchPriority: "high" as const } : {};

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={["reward-tile", "is-locked", className].filter(Boolean).join(" ")}
    >
      <span className="reward-tile-label">{label}</span>
      <picture className="reward-tile-piece">
        <source srcSet={iconSrc.replace(/\.png$/, ".avif")} type="image/avif" />
        <source srcSet={iconSrc.replace(/\.png$/, ".webp")} type="image/webp" />
        <img
          src={iconSrc}
          alt=""
          aria-hidden="true"
          {...dimAttrs}
          {...priorityAttrs}
        />
      </picture>
      {badge}
    </button>
  );
}
