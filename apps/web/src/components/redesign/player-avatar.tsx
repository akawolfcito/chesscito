"use client";

export type PlayerAvatarVariant = "you" | "bot";

type Variant = {
  base: string;
  defaultAlt: string;
};

const VARIANTS: Record<PlayerAvatarVariant, Variant> = {
  you: {
    base: "/art/new-icons-chesscito/avatar-blue 1",
    defaultAlt: "You",
  },
  bot: {
    base: "/art/new-icons-chesscito/avatar-red",
    defaultAlt: "Bot",
  },
};

type Props = {
  variant: PlayerAvatarVariant;
  alt?: string;
  className?: string;
};

export function PlayerAvatar({ variant, alt, className = "" }: Props) {
  const { base, defaultAlt } = VARIANTS[variant];
  return (
    <picture className={`player-card player-card-${variant} ${className}`.trim()}>
      <source srcSet={`${base}.avif`} type="image/avif" />
      <source srcSet={`${base}.webp`} type="image/webp" />
      <img src={`${base}.png`} alt={alt ?? defaultAlt} className="player-card-img" />
    </picture>
  );
}
