"use client";

import { useTranslations } from "next-intl";
import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";

import type { PassportSlotKind } from "@/lib/daily/passport";
import { todayUtc } from "@/lib/daily/progress";
import { focusWeek, type FocusWeekDayState } from "@/lib/daily/week";
import type { ThemeAssetKey } from "@/lib/themes/theme-registry";
import type { HubFocusPassport, SeasonChallengeMeta } from "@/components/hub/use-hub-data";

/** Flame sprites by catalog slot — same slots the standalone FocusPassport
 *  uses, so a theme re-skins the streak on both surfaces at once. */
const FLAME_SLOT: Record<PassportSlotKind, ThemeAssetKey> = {
  color: "shared.flame-color",
  blue: "shared.flame-blue",
  gray: "shared.flame-gray",
};

/** Weekly row → flame sprite. A proven completion burns blue, today burns gold,
 *  everything unproven stays gray and is separated by `data-state` in CSS —
 *  "missed" and "future" must not read the same even though both are gray. */
const WEEK_FLAME: Record<FocusWeekDayState, PassportSlotKind> = {
  completed: "blue",
  "today-done": "color",
  "today-pending": "gray",
  missed: "gray",
  future: "gray",
};

/** The four states the single primary CTA can be in. */
type CtaState = "join" | "start" | "tomorrow" | "complete";

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
  /** Optional: replays the intro mini-tour from the Focus Passport `?`.
   *  Omitted → no help chip renders. Replaying never touches progress,
   *  rewards or the "tour seen" flag. */
  onReplayTour?: () => void;
  /** UTC "YYYY-MM-DD" that anchors the weekly row. Defaults to `todayUtc()` —
   *  the SAME clock the Daily uses, so the row and the daily never disagree
   *  about which day is today. Injected so tests can pin it. */
  today?: string;
  /** Shields the player owns right now, `min(MAX, credited - consumed)`.
   *  Omitted → the chip is not rendered (a surface that cannot read the
   *  balance must not claim one). */
  shields?: { count: number; max: number };
};

export function CalendarIcon() {
  return (
    <svg viewBox="0 0 16 16" className="challenge-card-stat-icon" aria-hidden="true">
      <rect x="2" y="3" width="12" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M2 6h12M5 2v3M11 2v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
export function ShieldIcon() {
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
  onReplayTour,
  today,
  shields,
}: ChallengeCardProps) {
  const t = useTranslations("CHALLENGE_CARD_COPY");

  const isActive = seasonPass.active;
  const isLoading =
    focusPassport.isLoading || (!seasonPass.active && seasonPass.isLoading);

  const { durationDays } = challenge;
  const streak = isLoading ? 0 : Math.max(0, focusPassport.streak);
  const done = Math.min(streak, durationDays);

  // Calendar week (Monday-first, UTC) — replaces the old streak-derived flame
  // window. Same 7 sprites, but each one now names a real weekday, so the row
  // answers "did I show up this week?" instead of "how long is the run?".
  //
  // While loading we claim NOTHING: an empty run with today unreachable renders
  // 7 neutral slots. Structure is identical across loading / offer / active, so
  // the panel never resizes.
  const todayDate = today ?? todayUtc();
  // The run's last day. `lastCompletedDate` is authoritative — a stored streak
  // is NOT normalized on read (it only resets on the next completion), so a
  // stale streak would otherwise paint days the player never earned. Without
  // it we fall back to "today, if today is done", which can under-claim but
  // never over-claims.
  const runEnd =
    isLoading || streak === 0
      ? null
      : (focusPassport.lastCompletedDate ?? (focusPassport.todayDone ? todayDate : null));
  const week = focusWeek(todayDate, isLoading ? 0 : streak, runEnd);
  const weekdayLetters = t("weekdayLetters").split(",");
  const WEEK_STATE_LABEL: Record<FocusWeekDayState, Parameters<typeof t>[0]> = {
    completed: "weekDone",
    "today-done": "weekDoneToday",
    "today-pending": "weekToday",
    missed: "weekMissed",
    future: "weekUpcoming",
  };

  // Single primary CTA. Order matters: a finished challenge outranks a finished
  // day, and no pass outranks everything (the purchase is the whole point).
  const ctaState: CtaState = !isActive
    ? "join"
    : done >= durationDays
      ? "complete"
      : focusPassport.todayDone
        ? "tomorrow"
        : "start";

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
        <ThemeAssetPicture
          slot="hub.21-day-icon"
          pictureClassName="challenge-card-icon"
          alt=""
          aria-hidden="true"
          draggable={false}
        />
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
          <div className="challenge-card-passport-head">
            <p className="challenge-card-passport-label">{t("passportLabel")}</p>
            {onReplayTour ? (
              <button
                type="button"
                data-testid="challenge-replay-tour"
                className="challenge-card-passport-help"
                onClick={onReplayTour}
                aria-label={t("replayTourLabel")}
              >
                <span className="challenge-card-passport-help-dot" aria-hidden="true">
                  ?
                </span>
              </button>
            ) : null}
          </div>
          {(() => {
            const inner = (
              <>
                <span
                  className="challenge-card-week"
                  role="list"
                  aria-label={t("weekAriaLabel")}
                >
                  {week.map((day, i) => (
                    <span
                      key={day.date}
                      className="challenge-card-week-day"
                      role="listitem"
                      data-testid="challenge-week-day"
                      data-state={day.state}
                      data-date={day.date}
                      aria-label={t("weekDayAria", {
                        day: weekdayLetters[i] ?? "",
                        state: t(WEEK_STATE_LABEL[day.state]),
                      })}
                    >
                      <ThemeAssetPicture
                        slot={FLAME_SLOT[WEEK_FLAME[day.state]]}
                        pictureClassName={`challenge-card-flame${
                          day.state === "today-pending" ? " is-glow" : ""
                        }`}
                        pictureProps={{
                          "data-testid": "focus-passport-slot",
                          "data-kind": WEEK_FLAME[day.state],
                          "data-filled": WEEK_FLAME[day.state] !== "gray" || undefined,
                          "data-glow": day.state === "today-pending" || undefined,
                          "aria-hidden": true,
                        }}
                        alt=""
                        draggable={false}
                      />
                      <span className="challenge-card-week-letter" aria-hidden="true">
                        {weekdayLetters[i] ?? ""}
                      </span>
                    </span>
                  ))}
                </span>
                <span className="challenge-card-day-count">
                  {t("focusDaysFormat", { done, total: durationDays })}
                  {streak > 0 ? (
                    <span className="challenge-card-streak" data-testid="challenge-streak">
                      {t("streakFormat", { days: streak })}
                    </span>
                  ) : null}
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
          {/* Shields OWNED (live balance), distinct from the `+N` purchase
              bonus above. Rendered only when the container can actually read
              the balance — a chip with an invented count is worse than none. */}
          {shields ? (
            <span className="challenge-card-stat" data-testid="challenge-shields">
              <ShieldCheckIcon />
              {t("shieldsOwned", { count: shields.count, max: shields.max })}
            </span>
          ) : null}
        </div>
        {/* ── The single primary CTA ──────────────────────────────────────
            Exactly one, chosen by `ctaState`. `join` and `start` are real
            buttons; `tomorrow` and `complete` are STATUS text wearing the CTA
            skin — they inform, they do not block. Nothing here gates the piece
            shortcuts, training or score improvements, which live outside this
            card and stay reachable in every state. All four wear
            `.hub-lite-start-focus` so the panel keeps one CTA look. */}
        {ctaState === "join" ? (
          <>
            {/* Nudge arrow — points at Join, but ONLY while the mini-tour is
                spotlighting this card (CSS gates it on the tour's
                `data-tour-spotlight` attribute; hidden on the plain hub).
                Decorative; the subtle L→R nudge is CSS + reduced-motion aware. */}
            <ThemeAssetPicture
              slot="season.story-arrow"
              pictureClassName="challenge-card-join-arrow"
              alt=""
              aria-hidden="true"
              className="challenge-card-join-arrow-img"
              draggable={false}
            />
            <button
              type="button"
              // Pulses only while the purchase is actually available: `null` means
              // the status is still resolving (or the player already owns it), and
              // a CTA that throbs while disabled advertises a dead button.
              className={`hub-lite-start-focus challenge-card-cta${
                onJoinChallenge ? " is-pulsing" : ""
              }`}
              data-testid="challenge-cta"
              data-cta-state="join"
              aria-label={t("joinAriaLabel", { price: challenge.priceLabel })}
              onClick={onJoinChallenge ?? undefined}
              disabled={!onJoinChallenge}
            >
              {t("joinCta")}
              <span className="challenge-card-cta-price">{challenge.priceLabel}</span>
            </button>
          </>
        ) : ctaState === "start" ? (
          <button
            type="button"
            className="hub-lite-start-focus challenge-card-cta"
            data-testid="challenge-cta"
            data-cta-state="start"
            aria-label={t("ctaStartAriaLabel")}
            onClick={onFocusTap}
            disabled={!onFocusTap}
          >
            {t("ctaStartToday")}
          </button>
        ) : (
          <p
            className="hub-lite-start-focus challenge-card-cta challenge-card-cta--info"
            data-testid="challenge-cta"
            data-cta-state={ctaState}
            role="status"
            aria-label={
              ctaState === "tomorrow" ? t("ctaTomorrowAriaLabel") : t("ctaCompleteAriaLabel")
            }
          >
            {ctaState === "tomorrow" ? t("ctaTomorrow") : t("ctaComplete")}
          </p>
        )}
        {ctaState === "tomorrow" ? (
          <p className="challenge-card-cta-note" data-testid="challenge-cta-note">
            {t("tomorrowNote")}
          </p>
        ) : null}
      </div>
    </section>
  );
}
