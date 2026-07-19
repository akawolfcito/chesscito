"use client";

import { useTranslations } from "next-intl";
import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";

export type KingdomCardPro =
  | { active: true; daysRemaining: number }
  | { active: false };

export type KingdomCardProps = {
  /** PRO state. Drives the top-right chip only — the body + the 3 footer
   *  benefits are identical in both states (arena is free-to-all, never a
   *  paywall). */
  pro: KingdomCardPro;
  /** Fires when the non-PRO "PRO" discovery chip is tapped → opens the PRO
   *  sheet (same discovery affordance as the HUD `HubProBadge` inactive). */
  onProDiscover: () => void;
};

function BoltIcon() {
  return (
    <svg viewBox="0 0 16 16" className="kingdom-card-benefit-icon" aria-hidden="true">
      <path d="M8.5 1.5L3 9h4l-.5 5.5L13 7H9l-.5-5.5z" fill="currentColor" />
    </svg>
  );
}
function ShieldStarIcon() {
  return (
    <svg viewBox="0 0 16 16" className="kingdom-card-benefit-icon" aria-hidden="true">
      <path
        d="M8 1.5l5 2v4c0 3.2-2.1 5.2-5 6.5C5.1 12.7 3 10.7 3 7.5v-4l5-2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M8 5.4l.66 1.34 1.48.2-1.07 1.04.25 1.47L8 8.8l-1.32.65.25-1.47L5.86 6.94l1.48-.2z"
        fill="currentColor"
      />
    </svg>
  );
}
function GiftIcon() {
  return (
    <svg viewBox="0 0 16 16" className="kingdom-card-benefit-icon" aria-hidden="true">
      <rect x="2.5" y="6.5" width="11" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2 6.5h12M8 6.5v7" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M8 6.5C7 4 5.5 3.5 4.7 4.3c-.8.8 0 2.2 3.3 2.2zm0 0C9 4 10.5 3.5 11.3 4.3c.8.8 0 2.2-3.3 2.2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Play Kingdom hero panel (ref Image 2). Presentational leaf; caller owns
 *  PRO derivation + navigation. Models the `ChallengeCard` candy-panel: crest
 *  + title + PRO chip on top, 2-line body, and a 3-benefit inline footer. The
 *  panel is identical across PRO/non-PRO — only the chip flips (green active
 *  badge vs tappable discovery pill) so the height never changes. */
export function KingdomCard({ pro, onProDiscover }: KingdomCardProps) {
  const t = useTranslations("PLAY_HUB_COPY");

  return (
    <section
      className="kingdom-card"
      data-testid="kingdom-card"
      data-state={pro.active ? "pro" : "free"}
      aria-label={t("kingdomPanelTitle")}
    >
      <div className="kingdom-card-top">
        {/* eslint-disable-next-line jsx-a11y/aria-unsupported-elements */}
        <ThemeAssetPicture slot="hub.btn-battle" pictureClassName="kingdom-card-crest" alt="" aria-hidden="true" draggable={false} />
        <div className="kingdom-card-top-main">
          <header className="kingdom-card-head">
            <h2 className="kingdom-card-title">{t("kingdomPanelTitle")}</h2>
            {pro.active ? (
              <span
                className="kingdom-card-chip kingdom-card-chip--active"
                data-testid="kingdom-pro-chip"
              >
                {t("kingdomProActiveChip")}
              </span>
            ) : (
              <button
                type="button"
                className="kingdom-card-chip kingdom-card-chip--discover"
                data-testid="kingdom-pro-chip"
                aria-label={t("kingdomProDiscoverAriaLabel")}
                onClick={onProDiscover}
              >
                {t("kingdomProDiscoverChip")}
              </button>
            )}
          </header>
          <p className="kingdom-card-body">{t("kingdomPanelBody")}</p>
        </div>
      </div>

      <div className="kingdom-card-benefits" data-testid="kingdom-benefits">
        <span className="kingdom-card-benefit">
          <BoltIcon />
          {t("quickMatchLabel")}
        </span>
        <span className="kingdom-card-benefit">
          <ShieldStarIcon />
          {t("coachReviewLabel")}
        </span>
        <span className="kingdom-card-benefit">
          <GiftIcon />
          {t("rewardsLabel")}
        </span>
      </div>
    </section>
  );
}
