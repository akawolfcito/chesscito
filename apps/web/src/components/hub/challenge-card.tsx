"use client";

import { useTranslations } from "next-intl";

import { type PassportSlotKind, passportSlots } from "@/lib/daily/passport";
import type { HubFocusPassport, SeasonChallengeMeta } from "@/components/hub/use-hub-data";

/** Flame sprite basenames in `public/art/focus-passport/` — same assets the
 *  standalone FocusPassport uses. */
const FLAME_ASSET: Record<PassportSlotKind, string> = {
  color: "flame-color",
  blue: "flame-blue",
  gray: "flame-gray",
};

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

  // 7-flame streak window — same slot logic as the standalone FocusPassport.
  // Loading paints the safe empty (all-gray, no glow) shell.
  const slots = focusPassport.isLoading
    ? passportSlots(0, false).map((s) => ({ ...s, glow: false }))
    : passportSlots(
        focusPassport.streak < 0 ? 0 : focusPassport.streak,
        focusPassport.todayDone,
      );

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
          </header>

          <p className="challenge-card-passport-label">{t("passportLabel")}</p>
      <div className="challenge-card-flames" role="list" aria-label={t("passportLabel")}>
        {slots.map((slot, i) => {
          const filled = slot.kind !== "gray";
          const asset = FLAME_ASSET[slot.kind];
          return (
            // eslint-disable-next-line jsx-a11y/aria-unsupported-elements
            <picture
              key={i}
              role="listitem"
              data-testid="focus-passport-slot"
              data-kind={slot.kind}
              data-filled={filled || undefined}
              data-glow={slot.glow || undefined}
              className={`challenge-card-flame${slot.glow ? " is-glow" : ""}`}
            >
              <source srcSet={`/art/focus-passport/${asset}.avif`} type="image/avif" />
              <source srcSet={`/art/focus-passport/${asset}.webp`} type="image/webp" />
              <img
                src={`/art/focus-passport/${asset}.png`}
                alt={
                  filled
                    ? t("dotFilledAria", { index: i + 1 })
                    : t("dotEmptyAria", { index: i + 1 })
                }
                draggable={false}
              />
            </picture>
          );
        })}
          </div>
        </div>
      </div>

      {/* Lower section — ALWAYS rendered with a fixed structure so the panel
          height never changes across loading / offer / active (no flash). The
          stat values are static config; only the CTA slot swaps. */}
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
          {isActive ? (
            <>
              <span className="challenge-card-stat-value" data-testid="challenge-day">
                {`${seasonPass.dayOfChallenge}/${durationDays}`}
              </span>
              <span className="challenge-card-stat-label">{t("dayStat")}</span>
            </>
          ) : (
            <span className="challenge-card-stat-value">{challenge.priceLabel}</span>
          )}
        </div>
      </div>
      {isActive ? (
        <div
          className="challenge-card-join challenge-card-active-pill"
          data-testid="challenge-active-badge"
        >
          {t("activeBadge")}
        </div>
      ) : (
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
    </section>
  );
}
