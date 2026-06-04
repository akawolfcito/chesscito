"use client";

export type ActionRowIconName =
  | "battle-espadas"
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
    ["ejercicio-diario-chess", "learning", "play-chess", "practice-pieces", "save"].includes(name)
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
