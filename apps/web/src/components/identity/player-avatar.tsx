import * as React from "react";
import { cn } from "@/lib/utils";
import type { AvatarVariant } from "@/lib/identity/identity-lite";
import { AVATAR_PX, STYLE_DISC_COLOR, type AvatarSize } from "./avatar-style";

export type PlayerAvatarProps = {
  variant: AvatarVariant;
  size?: AvatarSize;
  /** Accessible label. Omit for a decorative avatar inside a labeled pill
   *  (renders alt=""); pass the nickname when the avatar stands alone. */
  alt?: string;
  className?: string;
};

/**
 * Deterministic player avatar: a style-colored disc with a white piece sprite.
 * Pure presentational — derives nothing; the caller passes the variant. Reuses
 * the existing `/art/pieces/w-<piece>` sprite set (no new assets, no remote
 * images). Spec: docs/specs/identity-lite-pr1.md
 */
export function PlayerAvatar({
  variant,
  size = "md",
  alt = "",
  className,
}: PlayerAvatarProps): React.JSX.Element {
  const px = AVATAR_PX[size];
  const color = STYLE_DISC_COLOR[variant.style];
  const base = `/art/pieces/w-${variant.piece}`;
  return (
    <span
      data-avatar-disc
      data-style={variant.style}
      data-piece={variant.piece}
      className={cn("player-avatar-disc", className)}
      style={{
        width: px,
        height: px,
        backgroundColor: color,
        boxShadow: `0 0 0 1px rgba(0,0,0,0.12), 0 2px 6px ${color}66`,
      }}
    >
      <picture>
        <source srcSet={`${base}.avif`} type="image/avif" />
        <source srcSet={`${base}.webp`} type="image/webp" />
        <img
          src={`${base}.png`}
          alt={alt}
          width={Math.round(px * 0.78)}
          height={Math.round(px * 0.78)}
          className="player-avatar-piece"
          draggable={false}
        />
      </picture>
    </span>
  );
}
