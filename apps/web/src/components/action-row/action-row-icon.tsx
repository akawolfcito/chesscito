"use client";

export type ActionRowIconName =
  | "battle-espadas"
  | "estrella"
  | "pergamino-tactico"
  | "refresh"
  | "shield-king"
  | "trofeo-epico"
  | "wallet";

type Props = {
  name: ActionRowIconName;
  className?: string;
  alt?: string;
};

export function ActionRowIcon({ name, className = "", alt = "" }: Props) {
  return (
    <img
      src={`/art/action-row/${name}.png`}
      alt={alt}
      aria-hidden={alt ? undefined : "true"}
      className={className}
      draggable={false}
    />
  );
}
