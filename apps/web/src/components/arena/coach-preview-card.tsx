"use client";

import { useTranslations } from "next-intl";

type CoachPreviewCardProps = {
  proActive: boolean;
  difficultyLabel: string;
  resultLabel: string;
  moveCount: number;
  onPrimaryCta: () => void;
  isCompact?: boolean;
};

export function CoachPreviewCard({
  proActive,
  difficultyLabel,
  resultLabel,
  moveCount,
  onPrimaryCta,
  isCompact,
}: CoachPreviewCardProps) {
  const t = useTranslations("ARENA_COPY");
  const activeTitle = t("coachPreview.activeTitle");
  const inactiveTitle = t("coachPreview.inactiveTitle");
  const benefits = t.raw("coachPreview.lockedBenefits") as readonly string[];

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
        <p className="coach-preview-card-body">
          {proActive
            ? t("coachPreview.activeBody")
            : t("coachPreview.insight", {
                difficulty: difficultyLabel,
                result: resultLabel,
                moves: moveCount,
              })}
        </p>
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
        {proActive ? t("coachPreview.activeCta") : t("coachPreview.inactiveCta")}
      </button>
    </section>
  );
}
