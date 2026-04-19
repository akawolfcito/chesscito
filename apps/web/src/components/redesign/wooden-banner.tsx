"use client";

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
