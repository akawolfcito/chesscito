"use client";

export type PlayerAvatarVariant = "you" | "bot";

type Variant = {
  src: string;
  defaultAlt: string;
};

const VARIANTS: Record<PlayerAvatarVariant, Variant> = {
  you: {
    src: "/art/new-icons-chesscito/avatar-blue 1.png",
    defaultAlt: "You",
  },
  bot: {
    src: "/art/new-icons-chesscito/avatar-red.png",
    defaultAlt: "Bot",
  },
};

type Props = {
  variant: PlayerAvatarVariant;
  alt?: string;
  className?: string;
};

export function PlayerAvatar({ variant, alt, className = "" }: Props) {
  const { src, defaultAlt } = VARIANTS[variant];
  return (
    <span className={`player-card player-card--new-icon player-card-${variant} ${className}`.trim()}>
      <img
        src={src}
        alt={alt ?? defaultAlt}
        className="player-card-img"
        draggable={false}
      />
    </span>
  );
}
