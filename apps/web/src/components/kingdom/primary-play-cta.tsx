"use client";

import { hapticTap } from "@/lib/haptics";

export type PrimaryPlayCtaSurface =
  | "playhub"
  | "arena"
  | "arena-entry"
  | "landing-hero"
  | "landing-final-cta";

export type Atmosphere = "adventure" | "scholarly";

type Props = {
  surface: PrimaryPlayCtaSurface;
  /** Caller-supplied label (e.g. "PLAY", "START"). Lives in editorial when
   *  the consuming surface lands; the primitive stays decoupled to avoid
   *  premature CTA_LABELS expansion. */
  label: string;
  ariaLabel: string;
  /** Visual register. Adventure (default) — kingdom-anchored gold treatment.
   *  Scholarly — paper-craft variant for Scholarly surfaces. */
  atmosphere?: Atmosphere;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  pieceIcon?: "pawn" | "king";
};

/** Backplate art per surface. Hub uses the candy-style green
 *  `principalbutton` introduced 2026-05-08 (audit B6); other surfaces
 *  retain the stone backplate so the redesign rolls in incrementally. */
const SURFACE_BACKPLATE_BASE: Record<PrimaryPlayCtaSurface, string> = {
  playhub: "/art/redesign/banners/principalbutton",
  arena: "/art/redesign/banners/btn-stone-bg",
  "arena-entry": "/art/redesign/banners/btn-stone-bg",
  "landing-hero": "/art/redesign/banners/btn-stone-bg",
  "landing-final-cta": "/art/redesign/banners/btn-stone-bg",
};

const SURFACE_ICON_BASE: Record<PrimaryPlayCtaSurface, string> = {
  playhub: "/art/redesign/banners/btn-battle",
  arena: "/art/redesign/banners/btn-play",
  "arena-entry": "/art/redesign/banners/btn-play",
  "landing-hero": "/art/redesign/banners/btn-play",
  "landing-final-cta": "/art/redesign/banners/btn-play",
};

/** Dominant primary action button for kingdom-anchored surfaces. Adventure
 *  primitive — stone backplate + battle/play icon overlay + warm-amber
 *  label. Haptic-tap fires on press; loading and disabled states block
 *  both `onPress` and the haptic. Pressed translateY + ambient pulse are
 *  handled in CSS. */
export function PrimaryPlayCta({
  surface,
  label,
  ariaLabel,
  atmosphere = "adventure",
  onPress,
  loading = false,
  disabled = false,
  className = "",
  pieceIcon,
}: Props) {
  const inert = loading || disabled;
  const iconBase = SURFACE_ICON_BASE[surface];
  const backplateBase = SURFACE_BACKPLATE_BASE[surface];

  const handleClick = () => {
    if (inert) {
      return;
    }
    hapticTap();
    onPress?.();
  };

  const classes = [
    "primary-play-cta",
    `primary-play-cta--${surface}`,
    `is-atmosphere-${atmosphere}`,
    loading ? "is-loading" : "",
    disabled ? "is-disabled" : "",
    pieceIcon ? "primary-play-cta--with-piece" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={ariaLabel}
      aria-busy={loading || undefined}
      disabled={inert}
      className={classes}
    >
      <picture className="primary-play-cta-backplate">
        <source srcSet={`${backplateBase}.avif`} type="image/avif" />
        <source srcSet={`${backplateBase}.webp`} type="image/webp" />
        <img
          src={`${backplateBase}.png`}
          alt=""
          aria-hidden="true"
          className="primary-play-cta-backplate-img"
        />
      </picture>
      <picture className="primary-play-cta-icon">
        <source srcSet={`${iconBase}.avif`} type="image/avif" />
        <source srcSet={`${iconBase}.webp`} type="image/webp" />
        <img
          src={`${iconBase}.png`}
          alt=""
          aria-hidden="true"
          className="primary-play-cta-icon-img"
        />
      </picture>
      {pieceIcon ? (
        <picture className="primary-play-cta-piece-icon">
          <source srcSet={`/art/redesign/pieces/w-${pieceIcon}.avif`} type="image/avif" />
          <source srcSet={`/art/redesign/pieces/w-${pieceIcon}.webp`} type="image/webp" />
          <img
            src={`/art/redesign/pieces/w-${pieceIcon}.png`}
            alt=""
            className="primary-play-cta-piece-icon-img"
          />
        </picture>
      ) : null}
      <span className="primary-play-cta-label">{label}</span>
    </button>
  );
}
