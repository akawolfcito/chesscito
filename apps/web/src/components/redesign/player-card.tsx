"use client";

export type PlayerCardVariant = "you" | "bot";

type Variant = {
  base: string;
  defaultAlt: string;
};

const VARIANTS: Record<PlayerCardVariant, Variant> = {
  you: {
    base: "/art/redesign/avatars/player-you",
    defaultAlt: "You",
  },
  bot: {
    base: "/art/redesign/avatars/player-opponent",
    defaultAlt: "Bot",
  },
};

type Props = {
  variant: PlayerCardVariant;
  alt?: string;
  className?: string;
};

export function PlayerCard({ variant, alt, className = "" }: Props) {
  const { base, defaultAlt } = VARIANTS[variant];
  return (
    <picture className={`player-card player-card-${variant} ${className}`.trim()}>
      <source srcSet={`${base}.avif`} type="image/avif" />
      <source srcSet={`${base}.webp`} type="image/webp" />
      <img src={`${base}.png`} alt={alt ?? defaultAlt} className="player-card-img" />
    </picture>
  );
}
