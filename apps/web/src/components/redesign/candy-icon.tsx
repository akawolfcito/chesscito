"use client";

import type { ImgHTMLAttributes } from "react";

import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";
import type { ThemeAssetKey } from "@/lib/themes/theme-registry";

export type CandyIconName =
  | "check"
  | "chevron-down"
  | "close"
  | "coach"
  | "copy"
  | "crosshair"
  | "crown"
  | "fingerprint"
  | "loading"
  | "lock"
  | "move"
  | "refresh"
  | "share"
  | "shield"
  | "shop"
  | "star"
  | "time"
  | "trophy"
  | "wallet";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> & {
  name: CandyIconName;
  /** Optional accessible label. Defaults to aria-hidden when omitted. */
  label?: string;
};

const THEME_SLOTS: Partial<Record<CandyIconName, ThemeAssetKey>> = {
  crown: "hud.crown",
  lock: "shared.lock",
  shield: "shared.shield",
  shop: "hub.shop-icon",
  star: "shared.star",
  time: "shared.time",
  trophy: "hud.trophy",
};

/** Renders the candy sprite with AVIF/WebP/PNG fallback chain. The user's
 *  className (sizing, color filters, etc.) goes on the <picture> wrapper;
 *  the <img> always fills its parent so sizing stays predictable. */
export function CandyIcon({ name, label, className = "", style, ...rest }: Props) {
  const decorative = label == null;
  const slot = THEME_SLOTS[name];
  if (slot) {
    return (
      <ThemeAssetPicture
        {...rest}
        slot={slot}
        pictureClassName={`candy-icon inline-block ${className}`.trim()}
        pictureStyle={style}
        alt={label ?? ""}
        aria-hidden={decorative ? true : undefined}
        className="block h-full w-full object-contain"
      />
    );
  }

  const base = `/art/redesign/icons/${name}`;
  return (
    <picture
      className={`candy-icon inline-block ${className}`.trim()}
      style={style}
    >
      <source srcSet={`${base}.avif`} type="image/avif" />
      <source srcSet={`${base}.webp`} type="image/webp" />
      <img
        {...rest}
        src={`${base}.png`}
        alt={label ?? ""}
        aria-hidden={decorative ? true : undefined}
        className="block h-full w-full object-contain"
      />
    </picture>
  );
}
