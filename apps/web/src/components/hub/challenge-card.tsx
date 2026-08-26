"use client";

import { useTranslations } from "next-intl";
import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";

import type { PassportSlotKind } from "@/lib/daily/passport";
import { todayUtc } from "@/lib/daily/progress";
import { focusWeek, type FocusWeekDayState } from "@/lib/daily/week";
import type { CtaLabelKey, CtaSlotPresentation } from "@/lib/hub/cta-slot";
import type { ChallengeProgressView } from "@/lib/season-pass/focus-days";
import type { ThemeAssetKey } from "@/lib/themes/theme-registry";
import type { HubFocusPassport, SeasonChallengeMeta } from "@/components/hub/use-hub-data";

/** Label → richer accessible name, where one exists.
 *
 *  The visible labels are compact by design (one line at 390px), and a compact
 *  label must not shorten the accessible name — "Comenzar foco" reads fine on
 *  screen but "Comienza tu foco de hoy" is what a screen reader should say.
 *  Keyed by LABEL, not by variant: the card presents, it does not interpret the
 *  product's priority ladder. Absent an entry the visible text is the accessible
 *  name, which is the correct default for an already-explicit action. */
const CTA_ARIA_LABEL: Partial<Record<CtaLabelKey, string>> = {
  ctaStartToday: "ctaStartAriaLabel",
};

/** Second line of the action banner, keyed by LABEL — same reason as above:
 *  the card presents, it does not read the product's priority ladder.
 *  `ctaTomorrow` has no entry because it never renders as an action. */
const CTA_SUBTITLE: Partial<Record<CtaLabelKey, string>> = {
  ctaStartToday: "subStartToday",
  ctaClaimGift: "subClaimGift",
  ctaKeepTraining: "subKeepTraining",
  ctaTryLabyrinth: "subTryLabyrinth",
  ctaBeatScore: "subBeatScore",
  ctaNewPiece: "subNewPiece",
  ctaViewProgress: "subViewProgress",
};

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
/** `start`, `tomorrow` and `complete` are all gone: every one of them was the
 *  card deciding on its own what the player should do next. Anything that is
 *  not a purchase is now `loop`, and the Content Loop says what it holds.
 *  Finishing the challenge is a STATE (it lives in the chip), never an
 *  answer to "what now". */
type CtaState = "join" | "loop";

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
  /** Navigates to the slot's destination. Takes the destination as an ARGUMENT
   *  on purpose: a `() => void` that recomputes the route is how the card ends
   *  up owning navigation again, and it compiles clean. */
  onFocusTap?: (destination: string) => void;
  /** The primary CTA's presentation, resolved upstream from the Content Loop.
   *
   *  The card reads `kind`, `labelKey`, `noteKey` and `destination` — never
   *  `variant`. Asking which variant this is would put the product's priority
   *  ladder back inside a leaf component, which is the defect Sprint 1 removes.
   *
   *  `null` = not hydrated yet → the slot renders a status, never a button. */
  ctaSlot?: CtaSlotPresentation | null;
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
   *  balance must not claim one).
   *
   *  No `max`: the cap is a display clamp, not a capacity the player fills, so
   *  showing it read as a tank — "0/3" looked terminal and "3/3" looked full
   *  while extra credits sat buffered and invisible. The clamp still lives in
   *  `shield-storage.ts`; it just stopped being a promise on screen. */
  shields?: { count: number };
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

/** The banner's affordance: it points INTO the purchase. Decorative — the
 *  button it lives in already carries the accessible name. The landing draws
 *  the same glyph on a strip that is not a control, which is deliberate: the
 *  two surfaces have to look identical for the pass to be recognisable. */
function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="season-pass-banner-chevron"
      data-testid="challenge-cta-chevron"
      aria-hidden="true"
    >
      <path
        d="M6 3.5L10.5 8L6 12.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
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
 *  Progress = focus days completed in the challenge = min(streak, challengeGoalDays).
 *  Structure is fixed across loading / offer / active so the panel never
 *  resizes. Copy avoids web3 / medical claims. */
export function ChallengeCard({
  focusPassport,
  challenge,
  seasonPass,
  progress,
  onJoinChallenge,
  onFocusTap,
  ctaSlot,
  onPassportTap,
  onReplayTour,
  today,
  shields,
}: ChallengeCardProps) {
  const t = useTranslations("CHALLENGE_CARD_COPY");

  /* ⛔ SALES PAUSED → THE PANEL STAYS, THE CHALLENGE GOES.
   *
   * This used to `return null`, which was wrong in a way nothing failed on: the
   * card carried the paid 21-day challenge AND the free daily habit, so hiding
   * the first deleted the second and left a hole where the Learn hub's most
   * used surface had been (357 Daily starts in 7 days, against 167 exercise
   * touches).
   *
   * `habitOnly` keeps the container, the Focus Passport with its weekday
   * letters, the mini-tour `?` and the Start Focus CTA — and drops everything
   * that belongs to the paused product: the 21-day icon, the challenge title,
   * the "X of 21" counter, the window, the benefits row and the purchase
   * banner. Re-enabling sales turns this off and the card is what it was.
   *
   * ⚠️ The structure is deliberately UNTOUCHED. The visual shape of this panel
   * was worked out over time; rebuilding it beside itself is what the first
   * attempt did, and it lost the weekday letters on the way. */
  const habitOnly = progress.state === "unavailable";

  const isActive = seasonPass.active;
  const isLoading =
    progress.state === "loading" ||
    focusPassport.isLoading ||
    (!seasonPass.active && seasonPass.isLoading);

  const { challengeGoalDays } = challenge;
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
  //
  // ⛔ `focusPassport.todayDone` is NOT consulted here any more. It is a second
  // reading of the same fact the Content Loop already decided with
  // `isCompletedToday(today, daily)`, and two readings hydrated by different
  // paths are exactly how the label and the destination drift apart. The
  // passport still owns the flames; it no longer owns the CTA.
  const isCompleted = progress.state === "completed";
  /* ⛔ `habitOnly` FORCES "loop". Without this the card would still offer the
   * purchase: `!isActive` is true precisely when nobody bought the pass, which
   * is the state the pause exists for. The CTA row keeps rendering — it is
   * Start Focus, from the Content Loop — but never the banner. */
  const ctaState: CtaState = !isActive && !habitOnly ? "join" : "loop";

  // A presentation that says "action" but has no handler wired (the `/dev`
  // probes mount this card without a router) must NOT render a button: that is
  // the original defect — a control that promises a tap and does nothing.
  const slot: CtaSlotPresentation =
    ctaSlot && !(ctaSlot.kind === "action" && !onFocusTap)
      ? ctaSlot
      : {
          kind: "status",
          variant: ctaSlot?.variant ?? "come-back-tomorrow",
          destination: null,
          labelKey: "ctaTomorrow",
          noteKey: "noteDailyReturns",
        };
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
        {/* The 21-day calendar: literal to the paused product, so it goes with
            it. Without an icon the passport row centres, which is the shape the
            habit-only panel wants anyway. */}
        {habitOnly ? null : (
          // eslint-disable-next-line jsx-a11y/aria-unsupported-elements
          <ThemeAssetPicture
            slot="hub.21-day-icon"
            pictureClassName="challenge-card-icon"
            alt=""
            aria-hidden="true"
            draggable={false}
          />
        )}
        <div className="challenge-card-top-main">
          <header className="challenge-card-head">
            {/* ⚠️ NO TITLE IN HABIT-ONLY MODE, pending Sally's call. Both
                strings name the 21-day challenge, so neither can stay; and the
                panel is a STATE, not an action, so it may not need a heading at
                all — `passportLabel` already heads the row below. */}
            {habitOnly ? null : (
              <h2 className="challenge-card-title">
                {isActive ? t("joinedTitle") : t("notJoinedTitle")}
              </h2>
            )}
            {isActive ? (
              /* The chip is where this card says WHAT STATE the player is in,
                 so finishing the challenge says it here too. It used to be
                 announced by the CTA slot instead, which meant the achievement
                 cost the player their next action — permanently, because
                 `completed` is terminal. Completion outranks the PRO label: it
                 is the bigger and rarer news, and it keeps the crown. */
              <span
                className={`challenge-card-active-chip${
                  isCompleted
                    ? " challenge-card-active-chip--pro text-center"
                    : seasonPass.source === "pro"
                      ? " challenge-card-active-chip--pro text-center"
                      : ""
                }`}
                data-testid="challenge-active-badge"
                data-challenge-completed={isCompleted ? "true" : undefined}
              >
                {isCompleted || seasonPass.source === "pro" ? <CrownIcon /> : null}
                {isCompleted
                  ? t("completedBadge")
                  : seasonPass.source === "pro"
                    ? t("includedWithPro")
                    : t("activeBadge")}
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
          {/* ⛔ The "X of 21" counter and the window are the paused product's own
              numbers. The streak is NOT — it is the daily run and it stays, but
              it lives inside this same line, so habit-only mode drops the line
              and the weekly row below carries the streak on its own. */}
          {habitOnly ? null : (
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

                ⚠️ 2026-08-25: that note assumed PRO was the only source of an
                unbounded window. It no longer is — PRO expires, so it now
                produces an `expiring` window like a pass does, and a PRO holder
                DOES see a countdown here. That is not the redundancy the
                original decision removed: "8 days left" is not "Included with
                PRO", it is the number that decides whether the challenge is
                still reachable at all. Hiding it is what let the card promise
                an impossible finish. `unbounded` now means a grant with no
                expiry whatsoever, and renders nothing as before. */}
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
          )}
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
          Special Training. Price lives exclusively on the CTA badge.

          ⛔ In habit-only mode the benefits row is skipped entirely: "21 days",
          "+3 Shields" and "Special Training" are TERMS OF A SALE that is
          paused. The CTA row below is kept — that is Start Focus, not a
          purchase — and the purchase banner inside it is gated separately. */}
      <div className="challenge-card-bottom">
        {habitOnly ? null : (
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
              {challengeGoalDays} {t("daysStat")}
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
                ? t("shieldsOwned", { count: shields.count })
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
        )}
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
              {/* THE SEASON PASS BANNER. Same shape the landing shows on
                  slide 2 (apps/landing · `SeasonPassBanner`), so a visitor who
                  met the pass during onboarding recognises it here. There it is
                  decorative; here it is the purchase itself.

                  It keeps `challenge-card-cta` — that class owns the pulse and
                  its reduced-motion override — but drops the green
                  `principal-button` skin: the banner IS the look. */}
              <button
                type="button"
                // Pulses only while the purchase is actually available: `null` means
                // the status is still resolving (or the player already owns it), and
                // a CTA that throbs while disabled advertises a dead button.
                className={`season-pass-banner challenge-card-cta${
                  onJoinChallenge ? " is-pulsing" : ""
                }`}
                data-testid="challenge-cta"
                data-cta-state="join"
                aria-label={t("joinAriaLabel", { price: challenge.priceLabel })}
                onClick={onJoinChallenge ?? undefined}
                disabled={!onJoinChallenge}
              >
                {/* The pass icon is the GOLDEN TICKET, not the card's own
                    calendar: the calendar heads the panel six lines up, and the
                    ticket is what the visitor saw on the landing. Same slot the
                    landing reads, so one Replace in the theme builder moves
                    both surfaces. */}
                <ThemeAssetPicture
                  slot="landing.season-pass-icon"
                  pictureClassName="season-pass-banner-icon"
                  pictureProps={{
                    "data-testid": "challenge-cta-icon",
                    "aria-hidden": true,
                  }}
                  alt=""
                  draggable={false}
                />
                <span className="season-pass-banner-copy">
                  <span className="season-pass-banner-title">{t("passBannerTitle")}</span>
                  <span className="season-pass-banner-benefits">
                    {t("passBannerBenefits", { shields: challenge.shieldBonus })}
                  </span>
                </span>
                {/* Price as a BADGE on the corner, not a chip in the row — the
                    house pattern for "this costs money" (`.challenge-card-cta-badge`,
                    shared with the Kingdom card's PRO row). Hidden from
                    assistive tech because `joinAriaLabel` already says the price
                    inside the button's accessible name; exposed twice it reads
                    as two prices. */}
                <span
                  className="season-pass-banner-badge"
                  data-testid="challenge-cta-price"
                  aria-hidden="true"
                >
                  {challenge.priceLabel}
                </span>
                <ChevronIcon />
              </button>
            </>
          ) : slot.kind === "action" ? (
            /* Banner form, not a pill (founder, 2026-08-07). The slot now has
               ONE geometry across its three states and the physics carries the
               meaning: raised is tapped, sunken informs. Each state still has a
               distinct composition signature — the offer is left-aligned with
               icon and price badge, this one is centred on a single line, the
               notice band is left-aligned over two lines. */
            <button
              type="button"
              className="challenge-card-cta challenge-card-cta--action"
              data-testid="challenge-cta"
              data-cta-state="loop"
              data-cta-kind="action"
              aria-label={t(CTA_ARIA_LABEL[slot.labelKey] ?? slot.labelKey)}
              onClick={() => onFocusTap?.(slot.destination)}
            >
              {/* No icon: seven different meanings share this slot (gift,
                  labyrinth, stars, piece…). One fixed icon that fits both
                  "Claim your gift" and "Beat your score" says nothing, and one
                  per variant costs seven theme slots plus three pinned
                  baselines each. The label already names the thing. */}
              <span className="challenge-card-cta-copy">
                <span className="challenge-card-cta-title">{t(slot.labelKey)}</span>
                {CTA_SUBTITLE[slot.labelKey] ? (
                  <span className="challenge-card-cta-sub" data-testid="challenge-cta-sub">
                    {t(CTA_SUBTITLE[slot.labelKey]!)}
                  </span>
                ) : null}
              </span>
              <ChevronIcon />
            </button>
          ) : (
            /* A NOTICE BAND, not a disabled button.

               It borrows the Season Pass banner's geometry so a future tip or
               announcement drops in without a re-layout — but it is SUNKEN
               (inset shadow) where the banner is RAISED (`0 3px 0` outward).
               That makes the tap contract physical instead of read: raised
               comes toward you and is pressed, sunken is carved into the card
               and contains something. A player feels it before deciding whether
               there is a chevron.

               ⛔ The children are `<span>`, not `<p>`: a `<p>` cannot contain a
               `<p>`, and the browser would close the outer one, silently
               rendering markup nobody wrote. */
            <p
              className="challenge-card-cta challenge-card-cta--quiet"
              data-testid="challenge-cta"
              data-cta-state="loop"
              data-cta-kind="status"
              role="status"
              aria-label={t("ctaTomorrowAriaLabel")}
            >
              {/* Icon slot deliberately empty in v1: no theme slot means
                  "night / rest / tomorrow", and the closest ones all say
                  "there is something to do" — the opposite of this state.
                  The hook stays so a tip with its own art is a prop, not a
                  re-layout. */}
              <span className="challenge-card-cta-copy">
                <span className="challenge-card-cta-title">{t(slot.labelKey)}</span>
                <span className="challenge-card-cta-note" data-testid="challenge-cta-note">
                  {t(slot.noteKey)}
                </span>
              </span>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
