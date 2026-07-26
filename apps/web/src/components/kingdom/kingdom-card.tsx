"use client";

import { useTranslations } from "next-intl";
import { HubProBadge } from "@/components/hub/hub-pro-badge";
import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";
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
