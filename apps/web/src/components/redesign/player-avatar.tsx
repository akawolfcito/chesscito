"use client";

import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";
import type { ThemeAssetKey } from "@/lib/themes/theme-registry";

export type PlayerAvatarVariant = "you" | "bot";

type Variant = {
  slot: ThemeAssetKey;
  defaultAlt: string;
  /** PRO ornament frame layered behind the avatar — color-matched to
   *  the avatar art so blue=you, red=bot reads as a single visual. */
  proFrameSlot: ThemeAssetKey;
};

const VARIANTS: Record<PlayerAvatarVariant, Variant> = {
  you: {
    slot: "arena.player-you",
    defaultAlt: "You",
    /* Refreshed 2026-05-31: golden ornamental border matched to the
     * blue avatar (user feedback — design/chesscito-pro source). */
    proFrameSlot: "arena.avatar-frame-you",
  },
  bot: {
    slot: "arena.player-bot",
    defaultAlt: "Bot",
    proFrameSlot: "arena.avatar-frame-bot",
  },
};

type Props = {
  variant: PlayerAvatarVariant;
  alt?: string;
  className?: string;
  /** When true, render the ornate PRO ornament frame as a layer
   *  behind the avatar (blue marco for "you", red marco for "bot").
   *  The frame is purely decorative and aria-hidden. */
  pro?: boolean;
  /** Override the avatar art with a custom sprite (full `.png` path).
   *  Used by the arena bot slot to show the SELECTED rival's character
   *  (Pipo/Mara/Kairo) instead of the generic red avatar. Triplet
   *  avif/webp/png siblings are derived from the `.png` path. */
  customSrc?: string;
  customSlot?: ThemeAssetKey;
};

export function PlayerAvatar({
  variant,
  alt,
  className = "",
  pro = false,
  customSrc,
  customSlot,
}: Props) {
  const { slot, defaultAlt, proFrameSlot } = VARIANTS[variant];
  return (
    <span
      className={`player-card player-card--new-icon player-card-${variant}${
        pro ? " player-card--pro" : ""
      } ${className}`.trim()}
    >
      <ThemeAssetPicture
        slot={proFrameSlot}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="player-card-pro-frame"
      />
      {customSrc && !customSlot ? (
        <picture>
          <source srcSet={customSrc.replace(/\.png$/, ".avif")} type="image/avif" />
          <source srcSet={customSrc.replace(/\.png$/, ".webp")} type="image/webp" />
          <img
            src={customSrc}
            alt={alt ?? defaultAlt}
            className="player-card-img"
            draggable={false}
          />
        </picture>
      ) : (
        <ThemeAssetPicture
          slot={customSlot ?? slot}
          alt={alt ?? defaultAlt}
          className="player-card-img"
          draggable={false}
        />
      )}
    </span>
  );
}
