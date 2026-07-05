"use client";

import { useTranslations } from "next-intl";

import type { HubFocusPassport, SeasonChallengeMeta } from "@/components/hub/use-hub-data";

/** Season-pass slice the card needs. Discriminated so the `active` branch
 *  carries the day-of-challenge + shields it must render, and the offer
 *  branch carries only its loading flag. */
export type ChallengeCardSeasonPass =
  | { active: false; isLoading: boolean }
  | { active: true; source: "pro" }
  | { active: true; source: "season_pass"; dayOfChallenge: number; shieldsCredited: number };

export type ChallengeCardProps = {
  focusPassport: HubFocusPassport;
  challenge: SeasonChallengeMeta;
  seasonPass: ChallengeCardSeasonPass;
  /** null when the pass is active (no purchase CTA, no glow). */
  onJoinChallenge: (() => void) | null;
};

function CalendarIcon() {
  return (
    <svg viewBox="0 0 16 16" className="challenge-card-stat-icon" aria-hidden="true">
      <rect x="2" y="3" width="12" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M2 6h12M5 2v3M11 2v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg viewBox="0 0 16 16" className="challenge-card-stat-icon" aria-hidden="true">
      <path d="M8 1.5l5 2v4c0 3.2-2.1 5.2-5 6.5C5.1 12.7 3 10.7 3 7.5v-4l5-2z" fill="currentColor" />
    </svg>
  );
}
function TagIcon() {
  return (
    <svg viewBox="0 0 16 16" className="challenge-card-stat-icon" aria-hidden="true">
      <path d="M2.5 2.5h5l6 6-5 5-6-6v-5z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="5.2" cy="5.2" r="1.1" fill="currentColor" />
    </svg>
  );
}

/** The 21-Day Mind Challenge hero card (Chesscito Lite) — compact layout
 *  (reference Image #10): icon + title + FOCUS PASSPORT progress bar on top, an
 *  inline stat row + Join Challenge below. Pure leaf: parent hydrates and passes
 *  props, no localStorage / wagmi here.
 *
 *  Progress = focus days completed in the challenge = min(streak, durationDays).
 *  Structure is fixed across loading / offer / active so the panel never
 *  resizes. Copy avoids web3 / medical claims. */
export function ChallengeCard({
  focusPassport,
  challenge,
  seasonPass,
  onJoinChallenge,
}: ChallengeCardProps) {
  const t = useTranslations("CHALLENGE_CARD_COPY");

  const isActive = seasonPass.active;
  const isLoading =
    focusPassport.isLoading || (!seasonPass.active && seasonPass.isLoading);

  const { durationDays } = challenge;
  const done = isLoading
    ? 0
    : Math.min(Math.max(focusPassport.streak, 0), durationDays);
  const pct = Math.round((done / durationDays) * 100);

  return (
    <section
      className="challenge-card"
      data-testid="challenge-card"
      data-state={isLoading ? "loading" : isActive ? "active" : "offer"}
      aria-label={t("rootAriaLabel")}
      aria-busy={isLoading || undefined}
    >
      <div className="challenge-card-top">
        {/* eslint-disable-next-line jsx-a11y/aria-unsupported-elements */}
        <picture className="challenge-card-icon">
          <source srcSet="/art/21-challenge-icon.avif" type="image/avif" />
          <source srcSet="/art/21-challenge-icon.webp" type="image/webp" />
          <img src="/art/21-challenge-icon.png" alt="" aria-hidden="true" draggable={false} />
        </picture>
        <div className="challenge-card-top-main">
          <header className="challenge-card-head">
            <h2 className="challenge-card-title">
              {isActive ? t("joinedTitle") : t("notJoinedTitle")}
            </h2>
            {isActive ? (
              <span
                className="challenge-card-active-chip"
                data-testid="challenge-active-badge"
              >
                {seasonPass.source === "pro" ? t("includedWithPro") : t("activeBadge")}
              </span>
            ) : null}
          </header>
          <p className="challenge-card-passport-label">{t("passportLabel")}</p>
          <div
            className="challenge-card-progress"
            data-testid="challenge-progress"
            data-done={done}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={durationDays}
            aria-valuenow={done}
          >
            {/* eslint-disable-next-line jsx-a11y/aria-unsupported-elements */}
            <picture className="challenge-card-progress-flame">
              <source srcSet="/art/focus-passport/flame-color.avif" type="image/avif" />
              <source srcSet="/art/focus-passport/flame-color.webp" type="image/webp" />
              <img src="/art/focus-passport/flame-color.png" alt="" aria-hidden="true" draggable={false} />
            </picture>
            <span className="challenge-card-progress-text">
              {t("focusDaysFormat", { done, total: durationDays })}
            </span>
            <span className="challenge-card-progress-track">
              <span className="challenge-card-progress-fill" style={{ width: `${pct}%` }} />
            </span>
          </div>
        </div>
      </div>

      {/* Bottom row — inline stats + Join (offer). Fixed structure so the panel
          height never changes across loading / offer / active (no flash). */}
      <div className="challenge-card-bottom">
        <div className="challenge-card-stats" data-testid="challenge-stats">
          <span className="challenge-card-stat">
            <CalendarIcon />
            {durationDays} {t("daysStat")}
          </span>
          <span className="challenge-card-stat">
            {isActive && seasonPass.source === "pro" ? (
              t("trainingPassStat")
            ) : (
              <>
                <ShieldIcon />
                {t("shieldsBonus", { count: challenge.shieldBonus })} {t("shieldsStat").toLowerCase()}
              </>
            )}
          </span>
          <span className="challenge-card-stat">
            {isActive ? (
              seasonPass.source === "pro" ? (
                <span data-testid="challenge-pro-coverage">{t("accessActive")}</span>
              ) : (
                <span data-testid="challenge-day">
                  {`${seasonPass.dayOfChallenge}/${durationDays} ${t("dayStat")}`}
                </span>
              )
            ) : (
              <>
                <TagIcon />
                {challenge.priceLabel}
              </>
            )}
          </span>
        </div>
        {isActive ? null : (
          <button
            type="button"
            className="challenge-card-join"
            data-testid="challenge-join-cta"
            aria-label={t("joinAriaLabel", { price: challenge.priceLabel })}
            onClick={onJoinChallenge ?? undefined}
            disabled={!onJoinChallenge}
          >
            {t("joinCta")}
          </button>
        )}
      </div>
    </section>
  );
}
