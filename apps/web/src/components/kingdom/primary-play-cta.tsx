"use client";

import { hapticTap } from "@/lib/haptics";
import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";
import type { ThemeAssetKey } from "@/lib/themes/theme-registry";

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
  pieceIconSlot?: ThemeAssetKey;
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

const SURFACE_BACKPLATE_SLOT: Record<PrimaryPlayCtaSurface, ThemeAssetKey | null> = {
  playhub: null,
  arena: "hub.btn-stone-bg",
  "arena-entry": null,
  "landing-hero": "hub.btn-stone-bg",
  "landing-final-cta": "hub.btn-stone-bg",
};

const SURFACE_ICON_SLOT: Record<PrimaryPlayCtaSurface, ThemeAssetKey> = {
  playhub: "hub.btn-battle",
  arena: "hub.btn-play",
  "arena-entry": "hub.btn-play",
  "landing-hero": "hub.btn-play",
  "landing-final-cta": "hub.btn-play",
};

const PIECE_ICON_SLOTS = {
  pawn: "board.piece.white.pawn",
  king: "board.piece.white.king",
} as const satisfies Record<"pawn" | "king", ThemeAssetKey>;

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
  pieceIconSlot,
  "data-testid": dataTestId,
}: Props) {
  const inert = loading || disabled;
  const iconSlot = SURFACE_ICON_SLOT[surface];
  const backplateSlot = SURFACE_BACKPLATE_SLOT[surface];

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
    pieceIcon || pieceIconSrc || pieceIconSlot ? "primary-play-cta--with-piece" : "",
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
      {backplateSlot ? (
        <ThemeAssetPicture
          slot={backplateSlot}
          pictureClassName="primary-play-cta-backplate"
          alt=""
          aria-hidden="true"
          className="primary-play-cta-backplate-img"
        />
      ) : null}
      <ThemeAssetPicture
        slot={iconSlot}
        pictureClassName="primary-play-cta-icon"
        alt=""
        aria-hidden="true"
        className="primary-play-cta-icon-img"
      />
      {pieceIconSlot ? (
        <span className="primary-play-cta-piece-icon">
          <ThemeAssetPicture
            slot={pieceIconSlot}
            alt=""
            aria-hidden="true"
            className="primary-play-cta-piece-icon-img"
            draggable={false}
          />
        </span>
      ) : pieceIconSrc ? (
        <span className="primary-play-cta-piece-icon">
          {pieceIconSrc.endsWith(".png") ? (
            /* Callers pass the .png path; its avif/webp siblings are ~10x
             * smaller (train-pieces 53KB→5KB), so negotiate them and keep
             * the png as fallback — same chain as the pieceIcon branch. */
            <picture>
              <source
                srcSet={pieceIconSrc.replace(/\.png$/, ".avif")}
                type="image/avif"
              />
              <source
                srcSet={pieceIconSrc.replace(/\.png$/, ".webp")}
                type="image/webp"
              />
              <img
                src={pieceIconSrc}
                alt=""
                aria-hidden="true"
                className="primary-play-cta-piece-icon-img"
                draggable={false}
              />
            </picture>
          ) : (
            <img
              src={pieceIconSrc}
              alt=""
              aria-hidden="true"
              className="primary-play-cta-piece-icon-img"
              draggable={false}
            />
          )}
        </span>
      ) : pieceIcon ? (
        <ThemeAssetPicture
          slot={PIECE_ICON_SLOTS[pieceIcon]}
          pictureClassName="primary-play-cta-piece-icon"
          alt=""
          className="primary-play-cta-piece-icon-img"
        />
      ) : null}
      <span className="primary-play-cta-label">{label}</span>
    </button>
  );
}
