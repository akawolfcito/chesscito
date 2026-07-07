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
  | { active: true; source: "pro" }
  | { active: true; source: "season_pass"; dayOfChallenge: number; shieldsCredited: number };

export type ChallengeCardProps = {
  focusPassport: HubFocusPassport;
  challenge: SeasonChallengeMeta;
  seasonPass: ChallengeCardSeasonPass;
  /** null when the pass is active (no purchase CTA, no glow). */
  onJoinChallenge: (() => void) | null;
  /** Optional: makes the flame/streak block a tap target into today's focus
   *  (same destination as Start Focus). Omitted → the block is static. */
  onFocusTap?: () => void;
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
function TicketIcon() {
  return (
    <svg viewBox="0 0 16 16" className="challenge-card-stat-icon" aria-hidden="true">
      <path
        d="M2.5 5.4h11v1.3a1.3 1.3 0 0 0 0 2.6v1.3h-11V9.3a1.3 1.3 0 0 0 0-2.6V5.4z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M8 6.2l0.62 1.45 1.57 0.14-1.19 1.03 0.35 1.54L8 9.6l-1.35 0.8 0.35-1.54-1.19-1.03 1.57-0.14z"
        fill="currentColor"
      />
    </svg>
  );
}
function ShieldCheckIcon() {
  return (
    <svg viewBox="0 0 16 16" className="challenge-card-stat-icon" aria-hidden="true">
      <path
        d="M8 1.5l5 2v4c0 3.2-2.1 5.2-5 6.5C5.1 12.7 3 10.7 3 7.5v-4l5-2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M5.6 7.7l1.6 1.6 3.1-3.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function CrownIcon() {
  return (
    <svg viewBox="0 0 16 16" className="challenge-card-active-chip-crown" aria-hidden="true">
      <path
        d="M2 5.5l2.6 2.2L8 3.5l3.4 4.2L14 5.5l-1 7H3l-1-7z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
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
  onFocusTap,
}: ChallengeCardProps) {
  const t = useTranslations("CHALLENGE_CARD_COPY");

  const isActive = seasonPass.active;
  const isLoading =
    focusPassport.isLoading || (!seasonPass.active && seasonPass.isLoading);

  const { durationDays } = challenge;
  const done = isLoading
    ? 0
    : Math.min(Math.max(focusPassport.streak, 0), durationDays);

  // 7-flame streak window — same slot logic as the standalone FocusPassport
  // (frozen-blue = earlier day done, orange-gold = today active, gray =
  // pending). Slots derive from the streak count, NOT calendar dates, so no
  // per-weekday labels (would imply data we do not persist — completedDates[]
  // is P1.5 backlog). Restores the pre-70ee44f7 view the bar replaced; the
  // "N/21 focus days" ordinal keeps the challenge-scale readout (UX spec §5,
  // 2026-07-06, day-labels dropped by stakeholder).
  const slots = isLoading
    ? passportSlots(0, false).map((s) => ({ ...s, glow: false }))
    : passportSlots(focusPassport.streak < 0 ? 0 : focusPassport.streak, focusPassport.todayDone);

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
          <source srcSet="/art/21-day-icon.avif" type="image/avif" />
          <source srcSet="/art/21-day-icon.webp" type="image/webp" />
          <img src="/art/21-day-icon.png" alt="" aria-hidden="true" draggable={false} />
        </picture>
        <div className="challenge-card-top-main">
          <header className="challenge-card-head">
            <h2 className="challenge-card-title">
              {isActive ? t("joinedTitle") : t("notJoinedTitle")}
            </h2>
            {isActive ? (
              <span
                className={`challenge-card-active-chip${
                  seasonPass.source === "pro"
                    ? " challenge-card-active-chip--pro text-center"
                    : ""
                }`}
                data-testid="challenge-active-badge"
              >
                {seasonPass.source === "pro" ? <CrownIcon /> : null}
                {seasonPass.source === "pro" ? t("includedWithPro") : t("activeBadge")}
              </span>
            ) : null}
          </header>
          <p className="challenge-card-passport-label">{t("passportLabel")}</p>
          {(() => {
            const inner = (
              <>
                <span className="challenge-card-flames" aria-hidden="true">
                  {slots.map((slot, i) => {
                    const asset = FLAME_ASSET[slot.kind];
                    return (
                      // eslint-disable-next-line jsx-a11y/aria-unsupported-elements
                      <picture
                        key={i}
                        data-testid="focus-passport-slot"
                        data-kind={slot.kind}
                        data-filled={slot.kind !== "gray" || undefined}
                        data-glow={slot.glow || undefined}
                        className={`challenge-card-flame${slot.glow ? " is-glow" : ""}`}
                      >
                        <source srcSet={`/art/focus-passport/${asset}.avif`} type="image/avif" />
                        <source srcSet={`/art/focus-passport/${asset}.webp`} type="image/webp" />
                        <img src={`/art/focus-passport/${asset}.png`} alt="" draggable={false} />
                      </picture>
                    );
                  })}
                </span>
                <span className="challenge-card-day-count">
                  {t("focusDaysFormat", { done, total: durationDays })}
                </span>
              </>
            );
            return onFocusTap ? (
              <button
                type="button"
                className="challenge-card-passport challenge-card-passport--tap"
                data-testid="challenge-progress"
                data-done={done}
                onClick={onFocusTap}
                aria-label={t("focusTapAria")}
              >
                {inner}
              </button>
            ) : (
              <div
                className="challenge-card-passport"
                data-testid="challenge-progress"
                data-done={done}
              >
                {inner}
              </div>
            );
          })()}
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
              <>
                <TicketIcon />
                {t("trainingPassStat")}
              </>
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
                <>
                  <ShieldCheckIcon />
                  <span data-testid="challenge-pro-coverage">{t("accessActive")}</span>
                </>
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
