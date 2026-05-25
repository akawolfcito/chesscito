"use client";

import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";

import { useIsProActive } from "@/lib/pro/use-is-pro-active";

export type KingdomAnchorVariant =
  | "playhub"
  | "arena-preview"
  | "landing-hero";

export type Atmosphere = "adventure" | "scholarly";

type Props = {
  variant?: KingdomAnchorVariant;
  /** Visual register. Adventure (default) = warm gold-leaf; Scholarly =
   *  warm-paper / paper-craft for /about + legal surfaces. */
  atmosphere?: Atmosphere;
  className?: string;
  style?: CSSProperties;
};

const ASPECT_RATIO: Record<KingdomAnchorVariant, string> = {
  playhub: "669 / 1040",
  "arena-preview": "1.3 / 1",
  "landing-hero": "1.5 / 1",
};

/** Hero portal asset paths. The `playhub`/`landing-hero` variants
 *  swap between `chesscito-normal-portal` and `chesscito-pro-portal`
 *  on `useIsProActive()` — paying subscribers see their wizard in
 *  premium garb as a quiet recognition cue. Both assets share the
 *  same `669 / 1040` aspect ratio so the surrounding layout doesn't
 *  jump on the swap. */
const HERO_ASSET_BASE_FREE =
  "/art/new-assets-chesscito/hub/chesscito-normal-portal";
const HERO_ASSET_BASE_PRO =
  "/art/new-assets-chesscito/hub/chesscito-pro-portal";
const BOARD_ASSET_BASE = "/art/redesign/board/board-ch";
const PIECES_ASSET_BASE = "/art/redesign/pieces";

type ArenaPreviewPiece = {
  file: number;
  rank: number;
  type: "rook" | "knight" | "bishop" | "queen" | "king" | "pawn";
  color: "w" | "b";
};

const BACK_RANK = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"] as const;

const STARTING_POSITION: ArenaPreviewPiece[] = (() => {
  const pieces: ArenaPreviewPiece[] = [];
  for (let file = 0; file < 8; file++) {
    pieces.push({ file, rank: 0, type: BACK_RANK[file], color: "w" });
    pieces.push({ file, rank: 1, type: "pawn", color: "w" });
    pieces.push({ file, rank: 6, type: "pawn", color: "b" });
    pieces.push({ file, rank: 7, type: BACK_RANK[file], color: "b" });
  }
  return pieces;
})();

/** Central diegetic visual that turns the Hub from menu into a place. Adventure
 *  atmosphere primitive — gold-leaf border + warm halo + drop shadow. The
 *  `playhub` and `landing-hero` variants render the kingdom hero render; the
 *  `arena-preview` variant renders a square chess board centered in the wider
 *  frame, overlaid with the standard starting position. Ambient idle animation
 *  is opt-in via CSS and disabled under `prefers-reduced-motion: reduce`. Not
 *  interactive; tap is captured by sibling CTAs. */
export function KingdomAnchor({
  variant = "playhub",
  atmosphere = "adventure",
  className = "",
  style,
}: Props) {
  const t = useTranslations("HOME_ANCHOR_COPY");
  const isProActive = useIsProActive();
  const heroAssetBase = isProActive
    ? HERO_ASSET_BASE_PRO
    : HERO_ASSET_BASE_FREE;
  const classes = [
    "kingdom-anchor",
    `kingdom-anchor--${variant}`,
    `is-atmosphere-${atmosphere}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div
      role="img"
      aria-label={t("alt")}
      className={classes}
      style={{ aspectRatio: ASPECT_RATIO[variant], ...style }}
    >
      {variant === "arena-preview" ? (
        <div className="kingdom-anchor-board-frame">
          <div className="kingdom-anchor-board-inner">
            <picture className="kingdom-anchor-picture">
              <source srcSet={`${BOARD_ASSET_BASE}.avif`} type="image/avif" />
              <source srcSet={`${BOARD_ASSET_BASE}.webp`} type="image/webp" />
              <img
                src={`${BOARD_ASSET_BASE}.png`}
                alt=""
                aria-hidden="true"
                className="kingdom-anchor-img"
              />
            </picture>
            <ul className="kingdom-anchor-board-pieces" aria-hidden="true">
              {STARTING_POSITION.map(({ file, rank, type, color }) => {
                const base = `${PIECES_ASSET_BASE}/${color}-${type}`;
                return (
                  <li
                    key={`${color}-${type}-${file}-${rank}`}
                    className="kingdom-anchor-board-piece"
                    style={{
                      left: `${file * 12.5}%`,
                      top: `${(7 - rank) * 12.5}%`,
                    }}
                  >
                    <picture>
                      <source srcSet={`${base}.avif`} type="image/avif" />
                      <source srcSet={`${base}.webp`} type="image/webp" />
                      <img src={`${base}.png`} alt="" />
                    </picture>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : (
        <>
          <picture className="kingdom-anchor-picture">
            <source srcSet={`${heroAssetBase}.avif`} type="image/avif" />
            <source srcSet={`${heroAssetBase}.webp`} type="image/webp" />
            <img
              src={`${heroAssetBase}.png`}
              alt=""
              aria-hidden="true"
              className="kingdom-anchor-img"
            />
          </picture>
          {/* Tagline rendered inside the portal frame, below the wizard.
           *  The highlight line is bolded as the focal closer. Same copy
           *  across both inactive + PRO portal variants for now. */}
          {variant === "playhub" && (
            <div className="kingdom-anchor-tagline" aria-hidden="true">
              <span className="kingdom-anchor-tagline-lead">
                {t("taglineLead")}
              </span>
              <span className="kingdom-anchor-tagline-highlight">
                {t("taglineHighlight")}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
