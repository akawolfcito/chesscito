"use client";

import { useTranslations } from "next-intl";
import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";

import type { PassportSlotKind } from "@/lib/daily/passport";
import { todayUtc } from "@/lib/daily/progress";
import { focusWeek, type FocusWeekDayState } from "@/lib/daily/week";
import type { ChallengeProgressView } from "@/lib/season-pass/focus-days";
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

/** Legacy stat glyphs retained for the Season Pass celebration. The Focus
 *  Passport benefits below resolve their art through Theme Builder slots. */
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

/** The four states the single primary CTA can be in. */
type CtaState = "join" | "start" | "tomorrow" | "complete";

/** Season-pass slice the card needs. Discriminated so the `active` branch
 *  carries the day-of-challenge + shields it must render, and the offer
 *  branch carries only its loading flag. */
export type ChallengeCardSeasonPass =
  | { active: false; isLoading: boolean }
  | { active: true; source: "pro" }
   | { active: true; source: "season_pass"; shieldsCredited: number };

export type ChallengeCardProps = {
  focusPassport: HubFocusPassport;
  challenge: SeasonChallengeMeta;
  seasonPass: ChallengeCardSeasonPass;
  /** The whole progress state, assembled upstream by
   *  `buildChallengeProgressView`. The card no longer derives progress from
   *  the streak: that number goes BACKWARD after a skipped day, which is the
   *  defect the Focus Days ledger replaces. */
  progress: ChallengeProgressView;
  /** null when the pass is active (no purchase CTA, no glow). */
  onJoinChallenge: (() => void) | null;
  /** Optional: makes the flame/streak block a tap target into today's focus
   *  exercise route. Reserved for the state-driven primary CTA. */
  onFocusTap?: () => void;
  /** Opens the Hub's canonical Daily Tactic sheet from the Focus Passport.
   *  Loading/completed passports remain static even when this is provided. */
  onPassportTap?: () => void;
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
  progress,
  onJoinChallenge,
  onFocusTap,
  onPassportTap,
  onReplayTour,
  today,
  shields,
}: ChallengeCardProps) {
  const t = useTranslations("CHALLENGE_CARD_COPY");

  const isActive = seasonPass.active;
  const isLoading =
    progress.state === "loading" ||
    focusPassport.isLoading ||
    (!seasonPass.active && seasonPass.isLoading);

  const { durationDays } = challenge;
  const streak = isLoading ? 0 : Math.max(0, focusPassport.streak);

  // Progress, ONLY where the ledger produced one. `disabled` and `offer` have
  // no number to show and must not invent one; `degraded` says the metric is
  // missing instead. None of them may fall back to the streak.
  const ledger =
    progress.state === "active" || progress.state === "completed" ? progress.progress : null;
  // Kept for the passport's `data-done` hook (flames + tour), which reads a
  // count of finished days. Absent a ledger answer it claims nothing.
  const done = ledger?.completed ?? 0;
  const window = "window" in progress ? progress.window : null;
  const unreachable = progress.state === "active" && progress.unreachable;

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
  //
  // `disabled` and `degraded` keep the ordinary Daily CTA: neither is a reason
  // to take the action away. `unreachable` keeps it too -- replacing the CTA
  // would turn a warning into a dead end, and the habit is the product.
  const ctaState: CtaState = !isActive
    ? "join"
    : progress.state === "completed"
      ? "complete"
      : focusPassport.todayDone
        ? "tomorrow"
        : "start";
  // Daily availability belongs to the passport, not to the commercial pass
  // request. A resolved pending Daily must stay tappable while Season Pass
  // status is still loading.
  const canOpenPassport =
    Boolean(onPassportTap) &&
    !focusPassport.isLoading &&
    !focusPassport.todayDone;

  return (
    <section
      className="challenge-card"
      data-testid="challenge-card"
      data-state={isLoading ? "loading" : isActive ? "active" : "offer"}
      // The ledger state, exposed separately from the commercial one: a card
      // that renders `disabled` and `degraded` identically hides an incident
      // behind a feature flag.
      data-progress-state={progress.state}
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
          {/* Ordinal FIRST, flames under it: the sentence the player reads is
              "Day N of 21", and the week below is the picture of that
              sentence. It stays in the icon column with the title it belongs
              to — only the 7-day row needs the full panel width. */}
          {/* Progress · window · streak. Three DIFFERENT metrics, never
              substituted for one another:
                - progress = distinct days the server recorded
                - window   = how much access is left
                - streak   = the daily run, a sibling cue
              The old "Day N of 21" line is gone on purpose: it read as a
              calendar ordinal while its number came from the streak, so it
              went backward after a skipped day. */}
          <p className="challenge-card-day-count">
            {ledger ? (
              <span
                className="challenge-card-progress-line"
                data-testid="challenge-progress-line"
              >
                {t("focusDaysProgress", {
                  completed: ledger.completed,
                  goal: ledger.goal,
                })}
              </span>
            ) : progress.state === "degraded" ? (
              // A failure of OURS, said plainly. `disabled` is a decision of
              // ours and says nothing: painting them alike would hide an
              // incident behind a flag.
              <span
                className="challenge-card-progress-note"
                data-testid="challenge-progress-unavailable"
              >
                {t("progressUnavailable")}
              </span>
            ) : null}
            {/* An unbounded window renders NOTHING here (founder, 2026-07-27).
                The badge above already says "PRO Benefit included"; saying
                "Included with PRO" again two lines down was the same sentence
                twice, and it pushed the title into two lines to make room.
                Nothing is lost: the badge only appears when `source === "pro"`,
                which is the only case that produces an unbounded window. */}
            {window && window.kind !== "unbounded" ? (
              <span className="challenge-card-window" data-testid="challenge-window">
                {t("windowDaysLeft", { days: window.daysRemaining })}
              </span>
            ) : null}
            {streak > 0 ? (
              <span className="challenge-card-streak" data-testid="challenge-streak">
                {t("streakFormat", { days: streak })}
              </span>
            ) : null}
          </p>
          {unreachable ? (
            <div className="challenge-card-unreachable" data-testid="challenge-unreachable">
              <p className="challenge-card-unreachable-title">{t("unreachableTitle")}</p>
              <p className="challenge-card-unreachable-body">{t("unreachableBody")}</p>
            </div>
          ) : null}
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
                <ThemeAssetPicture
                  slot="shared.tour-help"
                  pictureClassName="challenge-card-passport-help-icon"
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* The week is a SIBLING of the header row, not a child of the column
          beside the icon: 7 weekday columns need the panel's full width, and
          nested they were squeezed into ~250px at 390px. Same grammar as
          KingdomCard — header row, then a full-bleed band, then the divided
          benefits row. */}
      {(() => {
        const inner = (
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
                {/* Letter ABOVE its flame: it heads the column the way a
                    calendar names its days. Underneath it read as a caption
                    for the sprite instead of naming the day. */}
                <span className="challenge-card-week-letter" aria-hidden="true">
                  {weekdayLetters[i] ?? ""}
                </span>
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
              </span>
            ))}
          </span>
        );
        return canOpenPassport ? (
          <button
            type="button"
            className="challenge-card-passport challenge-card-passport--tap"
            data-testid="challenge-progress"
            data-done={done}
            onClick={onPassportTap}
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

      {/* Honest benefits only: duration, the applicable Shield figure and
          Special Training. Price lives exclusively on the CTA badge. */}
      <div className="challenge-card-bottom">
        <div className="challenge-card-stats" data-testid="challenge-stats">
          {/* Duration is a TERM OF THE SALE, so it rides with the offer and
              retires on enrolment: inside the challenge the title and "Day N
              of 21" already say it twice, and a third mention informs nobody.
              The offer state still renders the slot, so the catalog entry
              keeps a consumer. */}
          {!isActive ? (
            <span className="challenge-card-stat">
              <ThemeAssetPicture
                slot="hub.focus-passport-calendar"
                pictureClassName="challenge-card-stat-icon"
                alt=""
                aria-hidden="true"
                width={102}
                height={115}
                draggable={false}
              />
              {durationDays} {t("daysStat")}
            </span>
          ) : null}
          {!isActive || shields ? (
            <span className="challenge-card-stat" data-testid="challenge-shields">
              <ThemeAssetPicture
                slot="shared.shield"
                pictureClassName="challenge-card-stat-icon"
                alt=""
                aria-hidden="true"
                width={256}
                height={243}
                draggable={false}
              />
              {isActive && shields
                ? t("shieldsOwned", { count: shields.count, max: shields.max })
                : `${t("shieldsBonus", { count: challenge.shieldBonus })} ${t("shieldsStat")}`}
            </span>
          ) : null}
          <span className="challenge-card-stat">
            <ThemeAssetPicture
              slot="hub.training-icon"
              pictureClassName="challenge-card-stat-icon"
              alt=""
              aria-hidden="true"
              width={256}
              height={211}
              draggable={false}
            />
            {t("specialTrainingStat")}
          </span>
        </div>
        {/* ── The single primary CTA ──────────────────────────────────────
            Exactly one, chosen by `ctaState`. `join` and `start` are real
            buttons; `tomorrow` and `complete` are STATUS text wearing the CTA
            skin — they inform, they do not block. Nothing here gates the piece
            shortcuts, training or score improvements, which live outside this
            card and stay reachable in every state. All four wear
            `.hub-lite-start-focus` so the panel keeps one CTA look. */}
        {/* Arrow and CTA share ONE row. The arrow sprite points left→right and
            its nudge animates `translateX`, so it only reads as "look here"
            when it sits beside its target — stacked above, it pointed at
            nothing. Rotating the sprite would fight that same keyframe. */}
        {/* The mini-tour lights THIS row, not the panel — same granularity
            KingdomCard uses for its PRO row. The row (never the button alone)
            is the anchor because the nudge arrow is its sibling, and the
            arrow's CSS gate is a descendant selector. */}
        <div className="challenge-card-cta-row" data-tour-target="challenge">
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
                className={`principal-button principal-button-medium hub-lite-start-focus challenge-card-cta${
                  onJoinChallenge ? " is-pulsing" : ""
                }`}
                data-testid="challenge-cta"
                data-cta-state="join"
                aria-label={t("joinAriaLabel", { price: challenge.priceLabel })}
                onClick={onJoinChallenge ?? undefined}
                disabled={!onJoinChallenge}
              >
                {/* Price BADGE floating on the button, not an inline pill —
                    the same cost-cue pattern as the Save Victory tile
                    (`.coach-viewer__tile-price-ribbon`), so a price reads the
                    same wherever it appears. */}
                <span className="challenge-card-cta-badge" aria-hidden="true">
                  {challenge.priceLabel}
                </span>
                {t("joinCta")}
              </button>
            </>
          ) : ctaState === "start" ? (
            <button
              type="button"
              className="principal-button principal-button-medium challenge-card-cta"
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
              className="principal-button principal-button-medium challenge-card-cta challenge-card-cta--info"
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
        </div>
        {ctaState === "tomorrow" ? (
          <p className="challenge-card-cta-note" data-testid="challenge-cta-note">
            {t("tomorrowNote")}
          </p>
        ) : null}
      </div>
    </section>
  );
}
