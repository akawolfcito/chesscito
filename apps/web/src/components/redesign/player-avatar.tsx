"use client";

export type PlayerAvatarVariant = "you" | "bot";

type Variant = {
  src: string;
  defaultAlt: string;
  /** PRO ornament frame layered behind the avatar — color-matched to
   *  the avatar art so blue=you, red=bot reads as a single visual. */
  proFrameSrc: string;
};

const VARIANTS: Record<PlayerAvatarVariant, Variant> = {
  you: {
    src: "/art/new-icons-chesscito/avatar-blue.png",
    defaultAlt: "You",
    /* Refreshed 2026-05-31: golden ornamental border matched to the
     * blue avatar (user feedback — design/chesscito-pro source). */
    proFrameSrc: "/art/chesscito-pro/borde-dorado-avatar-azul.png",
  },
  bot: {
    src: "/art/new-icons-chesscito/avatar-red.png",
    defaultAlt: "Bot",
    proFrameSrc: "/art/chesscito-pro/borde-dorado-avatar-rojo.png",
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
};

export function PlayerAvatar({
  variant,
  alt,
  className = "",
  pro = false,
}: Props) {
  const { src, defaultAlt, proFrameSrc } = VARIANTS[variant];
  return (
    <span
      className={`player-card player-card--new-icon player-card-${variant}${
        pro ? " player-card--pro" : ""
      } ${className}`.trim()}
    >
      {pro && (
        <picture>
          <source srcSet={proFrameSrc.replace(/\.png$/, ".avif")} type="image/avif" />
          <source srcSet={proFrameSrc.replace(/\.png$/, ".webp")} type="image/webp" />
          <img
            src={proFrameSrc}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="player-card-pro-frame"
          />
        </picture>
      )}
      <img
        src={src}
        alt={alt ?? defaultAlt}
        className="player-card-img"
        draggable={false}
      />
    </span>
  );
}
