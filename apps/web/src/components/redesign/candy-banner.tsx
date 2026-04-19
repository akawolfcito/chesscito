"use client";

import type { ImgHTMLAttributes } from "react";

export type CandyBannerName =
  | "btn-back"
  | "btn-battle"
  | "btn-claim"
  | "btn-play"
  | "btn-resign"
  | "btn-undo";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> & {
  name: CandyBannerName;
  /** Optional accessible label. Defaults to aria-hidden when omitted. */
  label?: string;
};

/** Renders a candy banner sprite with AVIF/WebP/PNG fallback. The user's
 *  className (sizing) goes on the <picture> wrapper; the <img> always fills
 *  the parent so sizing stays predictable. */
export function CandyBanner({ name, label, className = "", style, ...rest }: Props) {
  const decorative = label == null;
  const base = `/art/redesign/banners/${name}`;
  return (
    <picture
      className={`candy-banner inline-block ${className}`.trim()}
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
