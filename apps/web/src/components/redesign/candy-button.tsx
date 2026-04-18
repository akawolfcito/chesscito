"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

export type CandyButtonVariant = "play" | "resign" | "undo" | "ghost";

type SpriteVariantConfig = {
  src: string;
  defaultLabel: string;
};

const SPRITE_VARIANTS: Record<Exclude<CandyButtonVariant, "ghost">, SpriteVariantConfig> = {
  play: { src: "/art/redesign/banners/btn-play.png", defaultLabel: "Play" },
  resign: { src: "/art/redesign/banners/btn-resign.png", defaultLabel: "Resign" },
  undo: { src: "/art/redesign/banners/btn-undo.png", defaultLabel: "Undo" },
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

  const { src, defaultLabel } = SPRITE_VARIANTS[variant];
  return (
    <button
      {...(rest as SpriteProps)}
      type={(rest as SpriteProps).type ?? "button"}
      aria-label={ariaLabel ?? defaultLabel}
      className={`candy-button candy-button-${variant} ${className}`.trim()}
    >
      <img src={src} alt="" aria-hidden="true" className="candy-button-img" />
    </button>
  );
}
