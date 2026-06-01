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
  pieceIconSrc?: string;
  "data-testid"?: string;
};

/** Backplate art per surface. Stone-textured surfaces keep their PNG
 *  backplate; the "green" surfaces (playhub + arena-entry) migrated
 *  2026-06-01 to a CSS gradient styled like .fail-rescue-modal-primary
 *  but in green — user requested consolidation so all "primary-action"
 *  buttons share the same bevel shadow + radius vocabulary. The CSS
 *  variant is selected by class `.primary-play-cta--green-css` applied
 *  in the className computation below. */
const GREEN_CSS_SURFACES = new Set<PrimaryPlayCtaSurface>([
  "playhub",
  "arena-entry",
]);

const SURFACE_BACKPLATE_BASE: Record<PrimaryPlayCtaSurface, string | null> = {
  playhub: null,
  arena: "/art/redesign/banners/btn-stone-bg",
  "arena-entry": null,
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
  pieceIconSrc,
  "data-testid": dataTestId,
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

  const usesGreenCss = GREEN_CSS_SURFACES.has(surface);

  const classes = [
    "primary-play-cta",
    `primary-play-cta--${surface}`,
    usesGreenCss ? "primary-play-cta--green-css" : "",
    `is-atmosphere-${atmosphere}`,
    loading ? "is-loading" : "",
    disabled ? "is-disabled" : "",
    pieceIcon || pieceIconSrc ? "primary-play-cta--with-piece" : "",
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
      data-testid={dataTestId}
    >
      {backplateBase ? (
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
      ) : null}
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
      {pieceIconSrc ? (
        <span className="primary-play-cta-piece-icon">
          <img
            src={pieceIconSrc}
            alt=""
            aria-hidden="true"
            className="primary-play-cta-piece-icon-img"
            draggable={false}
          />
        </span>
      ) : pieceIcon ? (
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
