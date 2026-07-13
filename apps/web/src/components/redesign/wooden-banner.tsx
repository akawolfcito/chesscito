"use client";

/** Carved wooden banner art — currently UNREFERENCED, and kept on purpose
 *  (founder call, 2026-07-13). Do NOT delete it as dead code.
 *
 *  All three variants only ever lived in the arena HUD, and left one at a
 *  time: `chess` + `your-turn` in 75166f2a, and `vs` in c6b6755c when the
 *  symmetric matchup header became the player rails. The art is intact under
 *  /art/redesign/banners/ (avif+webp+png for each variant), so this is ready
 *  to mount again the moment a surface wants it. */
export type WoodenBannerVariant = "chess" | "your-turn" | "vs";

type Variant = {
  base: string;
  defaultAlt: string;
};

const VARIANTS: Record<WoodenBannerVariant, Variant> = {
  chess: {
    base: "/art/redesign/banners/banner-chess",
    defaultAlt: "Chess",
  },
  "your-turn": {
    base: "/art/redesign/banners/banner-your-turn",
    defaultAlt: "Your Turn — Move a piece",
  },
  vs: {
    base: "/art/redesign/banners/vs-medal",
    defaultAlt: "VS",
  },
};

type Props = {
  variant: WoodenBannerVariant;
  alt?: string;
  className?: string;
};

export function WoodenBanner({ variant, alt, className = "" }: Props) {
  const { base, defaultAlt } = VARIANTS[variant];
  return (
    <picture className={`wooden-banner wooden-banner-${variant} ${className}`.trim()}>
      <source srcSet={`${base}.avif`} type="image/avif" />
      <source srcSet={`${base}.webp`} type="image/webp" />
      <img src={`${base}.png`} alt={alt ?? defaultAlt} className="wooden-banner-img" />
    </picture>
  );
}
