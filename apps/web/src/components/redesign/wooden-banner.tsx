"use client";

export type WoodenBannerVariant = "chess" | "your-turn" | "vs";

type Variant = {
  src: string;
  defaultAlt: string;
};

const VARIANTS: Record<WoodenBannerVariant, Variant> = {
  chess: {
    src: "/art/redesign/banners/banner-chess.png",
    defaultAlt: "Chess",
  },
  "your-turn": {
    src: "/art/redesign/banners/banner-your-turn.png",
    defaultAlt: "Your Turn — Move a piece",
  },
  vs: {
    src: "/art/redesign/banners/vs-medal.png",
    defaultAlt: "VS",
  },
};

type Props = {
  variant: WoodenBannerVariant;
  alt?: string;
  className?: string;
};

export function WoodenBanner({ variant, alt, className = "" }: Props) {
  const { src, defaultAlt } = VARIANTS[variant];
  return (
    <picture className={`wooden-banner wooden-banner-${variant} ${className}`.trim()}>
      <img src={src} alt={alt ?? defaultAlt} className="wooden-banner-img" />
    </picture>
  );
}
