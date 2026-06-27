"use client";

import { useTranslations } from "next-intl";

import type { HubFocusPassport, SeasonChallengeMeta } from "@/components/hub/use-hub-data";

/** Season-pass slice the card needs. Discriminated so the `active` branch
 *  carries the day-of-challenge + shields it must render, and the offer
 *  branch carries only its loading flag. */
export type ChallengeCardSeasonPass =
  | { active: false; isLoading: boolean }
  | { active: true; dayOfChallenge: number; shieldsCredited: number };

export type ChallengeCardProps = {
  focusPassport: HubFocusPassport;
  challenge: SeasonChallengeMeta;
  seasonPass: ChallengeCardSeasonPass;
  /** null when the pass is active (no purchase CTA, no glow). */
  onJoinChallenge: (() => void) | null;
};

/** The 21-Day Mind Challenge hero card (Chesscito Lite). Merges the Focus
 *  Passport streak row with the season-pass offer / active tracker into one
 *  card (reference Image #1/#2). Pure leaf: parent hydrates and passes props,
 *  no localStorage / wagmi here.
 *
 *  States (spec lite-hub-redesign.md §UI states):
 *    - loading   → empty dot shell, no CTA flash (skeleton-safe).
 *    - not-joined → dot row + 21/+3/$1.99 stat tiles + Join Challenge (verde+glow).
 *    - joined     → dot row + ACTIVE badge + Day X/21 + shields, no purchase CTA.
 *
 *  Streak dots: one pip per challenge day (`durationDays`); lit count =
 *  min(streak, durationDays) — meaning is identical pre- and post-purchase
 *  (spec §Streak dot semantics). Copy avoids web3 / medical claims. */
export function ChallengeCard({
  focusPassport,
  challenge,
  seasonPass,
  onJoinChallenge,
}: ChallengeCardProps) {
  const t = useTranslations("CHALLENGE_CARD_COPY");

  const isActive = seasonPass.active;
  // Offer state can still be resolving the pass status; gate the CTA + stat
  // tiles behind that to avoid the FOUC the old scaffold had (buy-CTA flashing
  // before `active` arrived).
  const isLoading =
    focusPassport.isLoading || (!seasonPass.active && seasonPass.isLoading);

  const { durationDays } = challenge;
  const litCount = isLoading
    ? 0
    : Math.min(Math.max(focusPassport.streak, 0), durationDays);
  // The next-pending pip glows only in the offer/active idle state when today
  // is not yet done (never while loading), nudging the daily focus.
  const glowIndex = !isLoading && !focusPassport.todayDone ? litCount : -1;

  return (
    <section
      className="challenge-card"
      data-testid="challenge-card"
      data-state={isLoading ? "loading" : isActive ? "active" : "offer"}
      aria-label={t("rootAriaLabel")}
      aria-busy={isLoading || undefined}
    >
      <header className="challenge-card-head">
        <h2 className="challenge-card-title">
          {isActive ? t("joinedTitle") : t("notJoinedTitle")}
        </h2>
        {isActive ? (
          <span className="challenge-card-active-badge" data-testid="challenge-active-badge">
            {t("activeBadge")}
          </span>
        ) : null}
      </header>

      {isActive ? (
        <p className="challenge-card-day" data-testid="challenge-day">
          {t("dayProgress", { day: seasonPass.dayOfChallenge, total: durationDays })}
        </p>
      ) : null}

      <p className="challenge-card-passport-label">{t("passportLabel")}</p>
      <div className="challenge-card-dots" role="list" aria-label={t("passportLabel")}>
        {Array.from({ length: durationDays }).map((_, i) => {
          const filled = i < litCount;
          return (
            <span
              key={i}
              role="listitem"
              data-testid="challenge-dot"
              data-filled={filled || undefined}
              data-glow={i === glowIndex || undefined}
              className={`challenge-card-dot${filled ? " is-filled" : ""}${
                i === glowIndex ? " is-glow" : ""
              }`}
              aria-label={
                filled
                  ? t("dotFilledAria", { index: i + 1 })
                  : t("dotEmptyAria", { index: i + 1 })
              }
            />
          );
        })}
      </div>

      {isActive ? (
        <div className="challenge-card-shields" data-testid="challenge-shields">
          <span className="challenge-card-shields-count">
            {t("shieldsCount", { count: seasonPass.shieldsCredited })}
          </span>
          <span className="challenge-card-shields-label">{t("shieldsStat")}</span>
        </div>
      ) : isLoading ? null : (
        <>
          <div className="challenge-card-stats" data-testid="challenge-stats">
            <div className="challenge-card-stat">
              <span className="challenge-card-stat-value">{durationDays}</span>
              <span className="challenge-card-stat-label">{t("daysStat")}</span>
            </div>
            <div className="challenge-card-stat">
              <span className="challenge-card-stat-value">
                {t("shieldsBonus", { count: challenge.shieldBonus })}
              </span>
              <span className="challenge-card-stat-label">{t("shieldsStat")}</span>
            </div>
            <div className="challenge-card-stat">
              <span className="challenge-card-stat-value">{challenge.priceLabel}</span>
            </div>
          </div>
          {onJoinChallenge ? (
            <button
              type="button"
              className="challenge-card-join"
              data-testid="challenge-join-cta"
              aria-label={t("joinAriaLabel", { price: challenge.priceLabel })}
              onClick={onJoinChallenge}
            >
              {t("joinCta")}
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}
