"use client";

import type { ImgHTMLAttributes } from "react";

export type CandyIconName =
  | "check"
  | "close"
  | "coach"
  | "crosshair"
  | "crown"
  | "fingerprint"
  | "lock"
  | "move"
  | "refresh"
  | "shield"
  | "star"
  | "time"
  | "trophy"
  | "wallet";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> & {
  name: CandyIconName;
  /** Optional accessible label. Defaults to aria-hidden when omitted. */
  label?: string;
};

export function CandyIcon({ name, label, className = "", ...rest }: Props) {
  const decorative = label == null;
  return (
    <img
      {...rest}
      src={`/art/redesign/icons/${name}.png`}
      alt={label ?? ""}
      aria-hidden={decorative ? true : undefined}
      className={`candy-icon inline-block object-contain ${className}`.trim()}
    />
  );
}
