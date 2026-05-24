"use client";

import { useTranslations } from "next-intl";

type CoachProCardProps = {
  active: boolean;
  remainingDays?: number;
  onCtaClick?: () => void;
};

export function CoachProCard({
  active,
  remainingDays = 0,
  onCtaClick,
}: CoachProCardProps) {
  const t = useTranslations("PRO_COPY");
  const stateKey = active ? "active" : "inactive";
  const title = active
    ? t("hubCoachCard.active.title", { remainingDays })
    : t("hubCoachCard.inactive.title");
  const body = t(`hubCoachCard.${stateKey}.body`);
  const features = active ? t("hubCoachCard.active.features") : null;
  const chips = t.raw(`hubCoachCard.${stateKey}.chips`) as readonly string[];
  const cta = t(`hubCoachCard.${stateKey}.cta`);
  const kicker = active ? t("coachKickerActive") : t("coachKickerInactive");

  return (
    <section
      className={`coach-pro-card${active ? " is-active" : " is-inactive"}`}
      aria-label={t("coachCardAriaLabel")}
    >
      <div className="coach-pro-card-copy">
        <span className="coach-pro-card-kicker">{kicker}</span>
        <h2 className="coach-pro-card-title">{title}</h2>
        <p className="coach-pro-card-body">{body}</p>
        {features ? (
          <p className="coach-pro-card-features">{features}</p>
        ) : null}
        <div
          className="coach-pro-card-chips"
          aria-label={t("coachChipsAriaLabel")}
        >
          {chips.map((chip) => (
            <span className="coach-pro-card-chip" key={chip}>
              {chip}
            </span>
          ))}
        </div>
      </div>
      <button
        type="button"
        className="coach-pro-card-cta"
        onClick={onCtaClick}
      >
        {cta}
      </button>
    </section>
  );
}
