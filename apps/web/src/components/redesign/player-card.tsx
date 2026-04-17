"use client";

export type PlayerCardVariant = "you" | "bot";

type Variant = {
  src: string;
  defaultAlt: string;
};

const VARIANTS: Record<PlayerCardVariant, Variant> = {
  you: {
    src: "/art/redesign/avatars/card-you.png",
    defaultAlt: "You",
  },
  bot: {
    src: "/art/redesign/avatars/card-bot.png",
    defaultAlt: "Bot",
  },
};

type Props = {
  variant: PlayerCardVariant;
  alt?: string;
  className?: string;
};

export function PlayerCard({ variant, alt, className = "" }: Props) {
  const { src, defaultAlt } = VARIANTS[variant];
  return (
    <picture className={`player-card player-card-${variant} ${className}`.trim()}>
      <img src={src} alt={alt ?? defaultAlt} className="player-card-img" />
    </picture>
  );
}
