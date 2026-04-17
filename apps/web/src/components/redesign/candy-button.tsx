"use client";

import type { ButtonHTMLAttributes } from "react";

export type CandyButtonVariant = "play" | "resign" | "undo";

type Variant = {
  src: string;
  defaultLabel: string;
};

const VARIANTS: Record<CandyButtonVariant, Variant> = {
  play: { src: "/art/redesign/banners/btn-play.png", defaultLabel: "Play" },
  resign: { src: "/art/redesign/banners/btn-resign.png", defaultLabel: "Resign" },
  undo: { src: "/art/redesign/banners/btn-undo.png", defaultLabel: "Undo" },
};

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  variant: CandyButtonVariant;
  ariaLabel?: string;
};

export function CandyButton({ variant, ariaLabel, className = "", ...buttonProps }: Props) {
  const { src, defaultLabel } = VARIANTS[variant];
  return (
    <button
      {...buttonProps}
      type={buttonProps.type ?? "button"}
      aria-label={ariaLabel ?? defaultLabel}
      className={`candy-button candy-button-${variant} ${className}`.trim()}
    >
      <img src={src} alt="" aria-hidden="true" className="candy-button-img" />
    </button>
  );
}
