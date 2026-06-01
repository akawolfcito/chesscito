"use client";

import { useTranslations } from "next-intl";

import { ARENA_PIECE_IMG } from "@/lib/game/arena-utils";
import { THEME_CONFIG } from "@/lib/theme";

type PromotionChoice = "q" | "r" | "b" | "n";

type Props = {
  onSelect: (piece: PromotionChoice) => void;
  onCancel: () => void;
};

const CHOICES_ORDER: PromotionChoice[] = ["q", "r", "b", "n"];

const PIECE_KEY_MAP: Record<PromotionChoice, keyof typeof ARENA_PIECE_IMG.w> = {
  q: "queen",
  r: "rook",
  b: "bishop",
  n: "knight",
};

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
          backgroundImage:
            'image-set(url("/art/new-assets-chesscito/paneles/panel-bg1.avif") type("image/avif"), url("/art/new-assets-chesscito/paneles/panel-bg1.webp") type("image/webp"), url("/art/new-assets-chesscito/paneles/panel-bg1.png") type("image/png"))',
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
          <picture>
            <source
              srcSet="/art/screen-mission/close-icon.avif"
              type="image/avif"
            />
            <source
              srcSet="/art/screen-mission/close-icon.webp"
              type="image/webp"
            />
            <img
              src="/art/screen-mission/close-icon.png"
              alt=""
              aria-hidden="true"
              className="h-10 w-10 object-contain"
              draggable={false}
            />
          </picture>
        </button>

        <div className="promotion-overlay-content">
          <p className="promotion-overlay-title">{t("promotionTitle")}</p>

          {/* Divider — two short lines flanking a small crown sprite.
              Same visual vocabulary as the wooden-banner / crown
              ornaments used elsewhere in the brand. */}
          <div className="promotion-overlay-divider" aria-hidden="true">
            <span className="promotion-overlay-divider-line" />
            <picture className="promotion-overlay-divider-crown">
              <source
                srcSet="/art/redesign/icons/crown.avif"
                type="image/avif"
              />
              <source
                srcSet="/art/redesign/icons/crown.webp"
                type="image/webp"
              />
              <img
                src="/art/redesign/icons/crown.png"
                alt=""
                aria-hidden="true"
              />
            </picture>
            <span className="promotion-overlay-divider-line" />
          </div>

          <div className="promotion-overlay-grid">
            {choices.map(({ key, label }) => {
              const isDefault = key === "q";
              const imgBase = ARENA_PIECE_IMG.w[PIECE_KEY_MAP[key]];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onSelect(key)}
                  aria-label={label}
                  className={[
                    "promotion-card",
                    isDefault ? "promotion-card--default" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {isDefault ? (
                    <picture
                      aria-hidden="true"
                      className="promotion-card-crown"
                    >
                      <source
                        srcSet="/art/redesign/icons/crown.avif"
                        type="image/avif"
                      />
                      <source
                        srcSet="/art/redesign/icons/crown.webp"
                        type="image/webp"
                      />
                      <img
                        src="/art/redesign/icons/crown.png"
                        alt=""
                        aria-hidden="true"
                      />
                    </picture>
                  ) : null}
                  <picture className="promotion-card-piece">
                    {THEME_CONFIG.hasOptimizedFormats && (
                      <>
                        <source
                          srcSet={imgBase.replace(".png", ".avif")}
                          type="image/avif"
                        />
                        <source
                          srcSet={imgBase.replace(".png", ".webp")}
                          type="image/webp"
                        />
                      </>
                    )}
                    <img src={imgBase} alt="" aria-hidden="true" />
                  </picture>
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
