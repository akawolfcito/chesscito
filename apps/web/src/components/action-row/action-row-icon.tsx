"use client";

export type ActionRowIconName =
  | "battle-espadas"
  | "ejercicio-diario-chess"
  | "estrella"
  | "learning"
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

export function ActionRowIcon({ name, className = "", alt = "" }: Props) {
  const iconBase = ["ejercicio-diario-chess", "learning", "play-chess", "practice-pieces", "save"].includes(name)
    ? "/art/new-icons-chesscito"
    : "/art/action-row";
  const base = `${iconBase}/${name}`;

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
