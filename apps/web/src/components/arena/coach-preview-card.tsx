"use client";

import { useTranslations } from "next-intl";

type CoachPreviewCardProps = {
  proActive: boolean;
  /** Free Coach credits remaining. Ignored when proActive=true (PRO
   *  users have no counter affordance). */
  credits: number;
  onPrimaryCta: () => void;
  isCompact?: boolean;
};

export function CoachPreviewCard({
  proActive,
  credits,
  onPrimaryCta,
  isCompact,
}: CoachPreviewCardProps) {
  const t = useTranslations("ARENA_COPY");
  const tCta = useTranslations("COACH_CTA_COPY");
  const activeTitle = t("coachPreview.activeTitle");
  const inactiveTitle = t("coachPreview.inactiveTitle");
  const benefits = t.raw("coachPreview.lockedBenefits") as readonly string[];

  const ctaLabel = proActive
    ? t("coachPreview.activeCta")
    : credits > 0
      ? tCta("askWithCounter", { count: credits })
      : tCta("askWhenZero");

  return (
    <section
      className={`coach-preview-card${proActive ? " is-active" : " is-inactive"}${isCompact ? " is-compact" : ""}`}
      aria-label={proActive ? activeTitle : inactiveTitle}
      data-testid="coach-preview-card"
    >
      <div className="coach-preview-card-copy">
        <span className="coach-preview-card-kicker">{t("coachPreview.cardKicker")}</span>
        <h3 className="coach-preview-card-title">
          {proActive ? activeTitle : inactiveTitle}
        </h3>
        {proActive ? (
          <p className="coach-preview-card-body">{t("coachPreview.activeBody")}</p>
        ) : null}
        {!proActive ? (
          <div
            className="coach-preview-card-chips"
            aria-label={t("coachPreview.cardChipsAriaLabel")}
          >
            {benefits.map((benefit) => (
              <span className="coach-preview-card-chip" key={benefit}>
                {benefit}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        className="coach-preview-card-cta"
        onClick={onPrimaryCta}
      >
        {ctaLabel}
      </button>
    </section>
  );
}
