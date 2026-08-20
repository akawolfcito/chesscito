"use client";

import type { ReactNode } from "react";

import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";
import type { ThemeAssetKey } from "@/lib/themes/theme-registry";

type Props = {
  iconSrc?: string;
  iconSlot?: ThemeAssetKey;
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
  tourTarget?: string;
  /** Stable hook for tests and the driven smoke. Optional: every tile that
   *  existed before this prop keeps rendering no attribute at all. */
  testId?: string;
  /** Extra `data-*` attributes for the tile's root.
   *
   *  ⚠️ Exists so a caller can keep STATE readable from the DOM after moving
   *  onto this tile. The mini-games cards carried `data-state` / `data-new` /
   *  `data-engine`, and three assertions read them; a tile with no passthrough
   *  would have silently dropped all three and the tests would have gone red
   *  for a reason unrelated to the change. Keys must already be `data-`
   *  prefixed — this does not invent the prefix, so what a caller writes is
   *  what lands in the DOM. */
  dataAttrs?: Record<string, string | undefined>;
};

/** Hub right-rail tile. Mirrors `.reward-tile.is-locked` exactly so the
 *  right rail reads as a structural sibling of the LEARN rail — same
 *  60×60 silhouette, same locked-piece stone backplate, same piece +
 *  label layout. Icon source PNGs are tall-aspect by design; the
 *  `.reward-tile-piece` container clamps them to 38×42 with
 *  `object-fit: contain` exactly like the LEARN piece images. */
export function HubActionTile({
  iconSrc,
  iconSlot,
  label,
  ariaLabel,
  onClick,
  disabled = false,
  badge,
  priority = false,
  iconWidth,
  iconHeight,
  className = "",
  tourTarget,
  testId,
  dataAttrs,
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
      data-tour-target={tourTarget}
      data-testid={testId}
      {...dataAttrs}
    >
      <span className="reward-tile-label">{label}</span>
      {iconSlot ? (
        <ThemeAssetPicture
          slot={iconSlot}
          pictureClassName="reward-tile-piece"
          alt=""
          aria-hidden="true"
          {...dimAttrs}
          {...priorityAttrs}
        />
      ) : iconSrc ? (
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
      ) : null}
      {badge}
    </button>
  );
}
