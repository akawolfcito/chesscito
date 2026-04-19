"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

export type CandyButtonVariant = "play" | "resign" | "undo" | "ghost";

type SpriteVariantConfig = {
  base: string;
  defaultLabel: string;
};

const SPRITE_VARIANTS: Record<Exclude<CandyButtonVariant, "ghost">, SpriteVariantConfig> = {
  play: { base: "/art/redesign/banners/btn-play", defaultLabel: "Play" },
  resign: { base: "/art/redesign/banners/btn-resign", defaultLabel: "Resign" },
  undo: { base: "/art/redesign/banners/btn-undo", defaultLabel: "Undo" },
};

type BaseButton = ButtonHTMLAttributes<HTMLButtonElement>;

type SpriteProps = Omit<BaseButton, "children"> & {
  variant: Exclude<CandyButtonVariant, "ghost">;
  ariaLabel?: string;
};

type GhostProps = BaseButton & {
  variant: "ghost";
  children: ReactNode;
  ariaLabel?: string;
};

type Props = SpriteProps | GhostProps;

export function CandyButton(props: Props) {
  const { variant, ariaLabel, className = "", ...rest } = props;

  if (variant === "ghost") {
    const { children, ...buttonProps } = rest as GhostProps;
    return (
      <button
        {...buttonProps}
        type={buttonProps.type ?? "button"}
        aria-label={ariaLabel}
        className={`candy-button candy-button-ghost ${className}`.trim()}
      >
        <span className="candy-button-ghost-label">{children}</span>
      </button>
    );
  }

  const { base, defaultLabel } = SPRITE_VARIANTS[variant];
  return (
    <button
      {...(rest as SpriteProps)}
      type={(rest as SpriteProps).type ?? "button"}
      aria-label={ariaLabel ?? defaultLabel}
      className={`candy-button candy-button-${variant} ${className}`.trim()}
    >
      <picture className="candy-button-img">
        <source srcSet={`${base}.avif`} type="image/avif" />
        <source srcSet={`${base}.webp`} type="image/webp" />
        <img src={`${base}.png`} alt="" aria-hidden="true" className="block h-full w-full object-contain" />
      </picture>
    </button>
  );
}
