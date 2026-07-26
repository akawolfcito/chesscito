"use client";

import { useTranslations } from "next-intl";
import { HubProBadge } from "@/components/hub/hub-pro-badge";
import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";
import type { ProDisplayState } from "@/lib/pro/use-is-pro-active";

export type KingdomCardPro = ProDisplayState;

export type KingdomCardProps = {
  /** PRO state. Drives the embedded discovery/status CTA — the body + the
   *  3 benefits remain identical because Arena is free-to-all, never a
   *  paywall. */
  pro: KingdomCardPro;
  /** Opens the PRO sheet for discovery, status or renewal. */
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

/** Play Kingdom hero panel. Presentational leaf; caller owns PRO derivation +
 *  navigation. The crowned PRO badge stays recognizable, but now lives inside
 *  a full-width explanatory CTA instead of disappearing as a tiny title chip.
 *  The CTA keeps one stable footprint across inactive/loading/error/active. */
export function KingdomCard({ pro, onProDiscover }: KingdomCardProps) {
  const t = useTranslations("PLAY_HUB_COPY");
  const tHud = useTranslations("HUD_COPY");
  const tRail = useTranslations("HUB_ACTION_RAIL_COPY");
  const proStatus = pro.status ?? (pro.active ? "active" : "inactive");
  const visualActive =
    pro.active ||
    (!pro.active &&
      "staleVisualActive" in pro &&
      pro.staleVisualActive);
  const proAriaLabel = pro.active
    ? tHud("proAriaLabel", { days: pro.daysRemaining })
    : proStatus === "inactive"
      ? tHud("proInactiveAriaLabel")
      : proStatus === "loading"
        ? tHud("proLoadingAriaLabel")
        : tHud("proUnavailableAriaLabel");

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

      <button
        type="button"
        className="kingdom-card-pro-cta"
        data-testid="kingdom-pro-cta"
        data-pro-status={proStatus}
        data-pro-visual-stale={!pro.active && visualActive ? "true" : undefined}
        aria-label={proAriaLabel}
        onClick={onProDiscover}
      >
        {/* The canonical crowned chip remains the recognition anchor. It is
            hidden from assistive tech because the outer CTA owns one complete
            accessible name and one tap target. */}
        <span className="kingdom-card-pro-visual" aria-hidden="true">
          <HubProBadge
            active={pro.active}
            status={proStatus}
            visualActive={visualActive}
            daysRemaining={pro.active ? pro.daysRemaining : undefined}
            daysLabel={
              pro.active
                ? tHud("proRemainingFormat", { days: pro.daysRemaining })
                : undefined
            }
            sublineInactive={tRail("proDiscoverySubtitle")}
            sublinePending={
              proStatus === "loading"
                ? tRail("proCheckingSubtitle")
                : tRail("proUnavailableSubtitle")
            }
            ariaLabel={proAriaLabel}
          />
        </span>
        <span className="kingdom-card-pro-copy">
          <span className="kingdom-card-pro-title">{t("kingdomProCtaTitle")}</span>
          <span className="kingdom-card-pro-subtitle">
            {t("kingdomProCtaSubtitle")}
          </span>
        </span>
        <span className="kingdom-card-pro-chevron" aria-hidden="true">
          ›
        </span>
      </button>
    </section>
  );
}
