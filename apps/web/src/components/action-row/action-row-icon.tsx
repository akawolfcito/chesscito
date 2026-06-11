"use client";

export type ActionRowIconName =
  | "battle-espadas"
  | "daily-icon-v1"
  | "ejercicio-diario-chess"
  | "estrella"
  | "learning"
  | "mate-icon"
  | "pergamino-tactico"
  | "play-chess"
  | "practice-pieces"
  | "refresh"
  | "save"
  | "shield-king"
  | "training-icon-v1"
  | "trofeo-epico"
  | "wallet";

type Props = {
  name: ActionRowIconName;
  className?: string;
  alt?: string;
};

function resolveIconBase(name: ActionRowIconName): string {
  if (name === "mate-icon") return "/art/hub";
  if (
    [
      "daily-icon-v1",
      "ejercicio-diario-chess",
      "learning",
      "play-chess",
      "practice-pieces",
      "save",
      "training-icon-v1",
    ].includes(name)
  ) {
    return "/art/new-icons-chesscito";
  }
  return "/art/action-row";
}

export function ActionRowIcon({ name, className = "", alt = "" }: Props) {
  const base = `${resolveIconBase(name)}/${name}`;

  return (
    <picture className={className}>
      <source srcSet={`${base}.avif`} type="image/avif" />
      <source srcSet={`${base}.webp`} type="image/webp" />
      <img
        src={`${base}.png`}
        alt={alt}
        aria-hidden={alt ? undefined : "true"}
        draggable={false}
      />
    </picture>
  );
}
