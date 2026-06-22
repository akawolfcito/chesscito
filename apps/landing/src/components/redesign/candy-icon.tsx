import type { ImgHTMLAttributes } from "react";

export type CandyIconName =
  | "check"
  | "chevron-down"
  | "close"
  | "coach"
  | "copy"
  | "crosshair"
  | "crown"
  | "fingerprint"
  | "loading"
  | "lock"
  | "move"
  | "refresh"
  | "share"
  | "shield"
  | "shop"
  | "star"
  | "time"
  | "trophy"
  | "wallet";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> & {
  name: CandyIconName;
  label?: string;
};

export function CandyIcon({ name, label, className = "", style, ...rest }: Props) {
  const decorative = label == null;
  const base = `/art/redesign/icons/${name}`;
  return (
    <picture
      className={`candy-icon inline-block ${className}`.trim()}
      style={style}
    >
      <source srcSet={`${base}.avif`} type="image/avif" />
      <source srcSet={`${base}.webp`} type="image/webp" />
      <img
        {...rest}
        src={`${base}.png`}
        alt={label ?? ""}
        aria-hidden={decorative ? true : undefined}
        className="block h-full w-full object-contain"
      />
    </picture>
  );
}
