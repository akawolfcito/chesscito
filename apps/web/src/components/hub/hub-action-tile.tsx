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
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className="reward-tile is-locked"
    >
      <span className="reward-tile-label">{label}</span>
      <picture className="reward-tile-piece">
        <img src={iconSrc} alt="" aria-hidden="true" />
      </picture>
      {badge}
    </button>
  );
}
