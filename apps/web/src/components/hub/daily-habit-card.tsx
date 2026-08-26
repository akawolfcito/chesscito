"use client";

import { useTranslations } from "next-intl";

import { FocusPassport } from "@/components/hub/focus-passport";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { PrincipalButton } from "@/components/scene-rooted/principal-button";
import type { CtaSlotPresentation } from "@/lib/hub/cta-slot";
import type { HubFocusPassport } from "@/components/hub/use-hub-data";

/**
 * The daily habit, WITHOUT the 21-day challenge around it.
 *
 * ⛔ WHY THIS EXISTS. Pausing Season Pass sales was approved; hiding the daily
 * habit was not, and that is what happened. `ChallengeCard` was rendering two
 * different products in one container — the paid 21-day challenge (the "X of 21"
 * counter, the window, the price) AND the free daily habit (the Focus Passport,
 * the streak, the shields, the Start Focus CTA). Returning `null` for the first
 * took the second with it, and the Learn hub lost its most used surface: 357
 * players started a Daily in 7 days, against 167 who touched exercises.
 *
 * So this is not a new feature. It is the half of that card that was never part
 * of the experiment, mounted on its own — `FocusPassport` already existed as a
 * standalone component, and the CTA takes the same `ctaSlot` presentation the
 * challenge card took.
 *
 * ⚠️ Carries NOTHING from the paused product: no day counter, no window, no
 * price, no purchase CTA. If sales are re-enabled, `ChallengeCard` comes back
 * and this steps aside — they are mutually exclusive by construction.
 */
export type DailyHabitCardProps = {
  focusPassport: HubFocusPassport;
  /** Live shields balance. Optional: probes mount without a wallet and must not
   *  invent a count. */
  shields?: { count: number };
  /** Opens today's Daily — the same instance the corner gift opens. */
  onPassportTap: () => void;
  /** The next-best-action, already resolved by the container. `null` before
   *  hydration: a button over unloaded data promises a destination nobody has
   *  computed yet. */
  ctaSlot: CtaSlotPresentation | null;
  onFocusTap: (destination: string) => void;
};

export function DailyHabitCard({
  focusPassport,
  shields,
  onPassportTap,
  ctaSlot,
  onFocusTap,
}: DailyHabitCardProps) {
  const t = useTranslations("CHALLENGE_CARD_COPY");

  return (
    <section className="daily-habit-card" data-testid="daily-habit-card">
      <button
        aria-label={t("focusTapAria")}
        className="daily-habit-passport"
        data-testid="daily-habit-passport"
        onClick={onPassportTap}
        type="button"
      >
        <FocusPassport
          isLoading={focusPassport.isLoading}
          streak={focusPassport.streak}
          todayDone={focusPassport.todayDone}
          totalCompleted={focusPassport.totalCompleted}
        />
      </button>

      {shields ? (
        <div className="daily-habit-stats" data-testid="daily-habit-shields">
          <CandyIcon className="daily-habit-stat-icon" name="shield" />
          <span>{t("shieldsOwned", { count: shields.count })}</span>
        </div>
      ) : null}

      {ctaSlot?.kind === "action" ? (
        <PrincipalButton
          data-testid="daily-habit-cta"
          onClick={() => onFocusTap(ctaSlot.destination)}
          size="medium"
        >
          {t(ctaSlot.labelKey)}
        </PrincipalButton>
      ) : ctaSlot ? (
        /* A status, not a button. `view-progress` fires both when the catalog is
           empty and while it is still loading, so "I don't know yet" must not
           render a confident destination. */
        <p className="daily-habit-status" data-testid="daily-habit-status">
          {t(ctaSlot.labelKey)}
        </p>
      ) : null}
    </section>
  );
}
