"use client";

import { useTranslations } from "next-intl";
import { HubProBadge } from "@/components/hub/hub-pro-badge";
import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";
import { PRO_PRICE_USD6 } from "@/lib/contracts/shop-catalog";
import { formatUsd } from "@/lib/contracts/tokens";
import type { ProDisplayState } from "@/lib/pro/use-is-pro-active";
import type { ThemeAssetKey } from "@/lib/themes/theme-registry";

export type KingdomCardPro = ProDisplayState;

export type KingdomCardProps = {
  /** PRO state. Drives the embedded discovery/status CTA — the body + the
   *  3 benefits remain identical because Arena is free-to-all, never a
   *  paywall. */
  pro: KingdomCardPro;
  /** Opens the PRO sheet for discovery, status or renewal. */
  onProDiscover: () => void;
  /** Replays the PLAY mini-tour from the persistent question icon. */
  onReplayTour?: () => void;
};

function KingdomBenefit({
  iconSlot,
  label,
}: {
  iconSlot: ThemeAssetKey;
  label: string;
}) {
  return (
    <span className="kingdom-card-benefit">
      <ThemeAssetPicture
        slot={iconSlot}
        pictureClassName="kingdom-card-benefit-icon"
        alt=""
        aria-hidden="true"
        draggable={false}
      />
      {label}
    </span>
  );
}

/** Play Kingdom hero panel. Presentational leaf; caller owns PRO derivation +
 *  navigation. The crowned PRO badge stays recognizable, but now lives inside
 *  a full-width explanatory CTA instead of disappearing as a tiny title chip.
 *  The CTA keeps one stable footprint across inactive/loading/error/active. */
export function KingdomCard({
  pro,
  onProDiscover,
  onReplayTour,
}: KingdomCardProps) {
  const t = useTranslations("PLAY_HUB_COPY");
  const tHud = useTranslations("HUD_COPY");
  const tRail = useTranslations("HUB_ACTION_RAIL_COPY");
  const proStatus = pro.status ?? (pro.active ? "active" : "inactive");
  // Price is stable catalog information, not an availability signal. Keep it
  // visible for every non-PRO state (including checking/unavailable) while the
  // crowned status chip explains whether purchase can proceed right now.
  const showPurchasePrice = !pro.active;
  const proPriceLabel = formatUsd(PRO_PRICE_USD6);
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
    // The whole card is the mini-tour's first target: the spotlit card IS the
    // illustration for "Welcome to Play Kingdom", so the tour panel does not
    // repeat the benefits below. Removing this attribute does not fail loudly —
    // HubTour silently drops steps whose target is absent — so it is covered by
    // a test that counts the steps.
    <section
      className="kingdom-card"
      data-testid="kingdom-card"
      data-tour-target="kingdom"
      data-state={pro.active ? "pro" : "free"}
      aria-label={t("kingdomPanelTitle")}
    >
      <div className="kingdom-card-top">
        {/* eslint-disable-next-line jsx-a11y/aria-unsupported-elements */}
        <ThemeAssetPicture slot="hub.btn-battle" pictureClassName="kingdom-card-crest" alt="" aria-hidden="true" draggable={false} />
        <div className="kingdom-card-top-main">
          <header className="kingdom-card-head">
            <h2 className="kingdom-card-title">{t("kingdomPanelTitle")}</h2>
            {onReplayTour ? (
              <button
                type="button"
                className="kingdom-card-tour-help"
                data-testid="kingdom-replay-tour"
                onClick={onReplayTour}
                aria-label={t("replayTourAriaLabel")}
              >
                <ThemeAssetPicture
                  slot="shared.tour-help"
                  pictureClassName="kingdom-card-tour-help-icon"
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                />
              </button>
            ) : null}
          </header>
          <p className="kingdom-card-body">{t("kingdomPanelBody")}</p>
        </div>
      </div>

      <div className="kingdom-card-benefits" data-testid="kingdom-benefits">
        <KingdomBenefit
          iconSlot="hub.quick-match-benefit"
          label={t("quickMatchLabel")}
        />
        <KingdomBenefit
          iconSlot="hub.coach-review-benefit"
          label={t("coachReviewLabel")}
        />
        <KingdomBenefit
          iconSlot="hub.rewards-benefit"
          label={t("rewardsLabel")}
        />
      </div>

      <button
        type="button"
        className="kingdom-card-pro-cta"
        data-tour-target="pro"
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
        {showPurchasePrice ? (
          <span
            className="kingdom-card-pro-price"
            data-testid="kingdom-pro-price"
            aria-hidden="true"
          >
            {proPriceLabel}
          </span>
        ) : null}
      </button>
    </section>
  );
}
