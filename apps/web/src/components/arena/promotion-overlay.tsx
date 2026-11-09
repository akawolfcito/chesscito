"use client";

import { useTranslations } from "next-intl";

import { THEME_CONFIG } from "@/lib/theme";
import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";
import { useThemePieceAssets } from "@/lib/themes/piece-theme-assets";
import { useThemeBackground } from "@/lib/themes/use-theme-background";

type PromotionChoice = "q" | "r" | "b" | "n";

type Props = {
  onSelect: (piece: PromotionChoice) => void;
  onCancel: () => void;
};

const CHOICES_ORDER: PromotionChoice[] = ["q", "r", "b", "n"];

const PIECE_KEY_MAP = {
  q: "queen",
  r: "rook",
  b: "bishop",
  n: "knight",
} as const;

/**
 * Promotion picker. Adopts the same panel-bg1 visual family used by
 * VictoryPopupShell + FailRescueModal so the player reads it as a
 * sibling popup, not a separate modal class. Queen card carries a
 * "default choice" highlight (gold ring + small crown above) — in
 * chess promotion the queen is the optimal pick 99% of the time, so
 * the visual cue accelerates the decision without removing agency.
 *
 * Visual ref: user-supplied Image #27, 2026-06-01.
 */
export function PromotionOverlay({ onSelect, onCancel }: Props) {
  const t = useTranslations("ARENA_COPY");
  const tPiece = useTranslations("PIECE_LABELS");
  const pieceAssets = useThemePieceAssets();
  const panelBackground = useThemeBackground("shared.panel-bg");
  const choices = CHOICES_ORDER.map((key) => ({
    key,
    label: tPiece(PIECE_KEY_MAP[key]),
  }));

  return (
    /* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
    <div
      className="candy-modal-scrim pointer-events-auto fixed inset-0 z-30 flex items-center justify-center animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label={t("promotionTitle")}
      onClick={onCancel}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        className="promotion-overlay-panel relative mx-4 w-full max-w-[480px]"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundImage: panelBackground,
          backgroundSize: "100% 100%",
          backgroundRepeat: "no-repeat",
        }}
      >
        <button
          type="button"
          onClick={onCancel}
          aria-label={t("promotionCancelAriaLabel")}
          className="candy-close-asset-button absolute right-[4%] top-[4%] z-10"
        >
          <ThemeAssetPicture slot="shared.close" alt="" aria-hidden="true" className="h-10 w-10 object-contain" draggable={false} />
        </button>

        <div className="promotion-overlay-content">
          <p className="promotion-overlay-title">{t("promotionTitle")}</p>

          {/* Divider — single ornamental sprite (adorno-icon triplet)
              that already exists in the brand asset library. Replaces
              the earlier line + crown composite. User feedback
              2026-06-01. */}
          <ThemeAssetPicture
            slot="shared.mission-adorno"
            pictureClassName="promotion-overlay-adorno"
            alt=""
            aria-hidden="true"
          />

          <div className="promotion-overlay-grid">
            {choices.map(({ key, label }) => {
              const imgBase = pieceAssets.w[PIECE_KEY_MAP[key]];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onSelect(key)}
                  aria-label={label}
                  className="promotion-card"
                >
                  {imgBase ? <picture className="promotion-card-piece">
                    {THEME_CONFIG.hasOptimizedFormats && (
                      <>
                        <source
                          srcSet={`${imgBase}.avif`}
                          type="image/avif"
                        />
                        <source
                          srcSet={`${imgBase}.webp`}
                          type="image/webp"
                        />
                      </>
                    )}
                    <img src={`${imgBase}.png`} alt="" aria-hidden="true" />
                  </picture> : null}
                  <span className="promotion-card-label">{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
