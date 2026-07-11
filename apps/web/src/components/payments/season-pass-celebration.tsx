"use client";

import { useTranslations } from "next-intl";

import { CalendarIcon, ShieldIcon } from "@/components/hub/challenge-card";
import { ConfettiBurst } from "@/components/redesign/confetti-burst";

/** Full-panel art (frame + shield + ribbon + garden baked in). Consumed by the
 *  shell as the panel background, replacing `panel-bg1`. */
export const CELEBRATION_PANEL_BG =
  'image-set(url("/art/celebration/bg-celebration.avif") type("image/avif"), url("/art/celebration/bg-celebration.webp") type("image/webp"), url("/art/celebration/bg-celebration.png") type("image/png"))';

export type SeasonPassCelebrationProps = {
  durationDays: number;
  /** Read from the verified receipt, NOT hardcoded: verify-payment answers 0
   *  when the payment settled but the shield grant did not (Redis failure,
   *  recovered on a later verify). Promising "+3 Shields" there would lie. */
  shieldsCredited: number;
  /** Start Focus — the hub's own CTA copy and destination. */
  onStartFocus: () => void;
};

export function SeasonPassCelebration({
  durationDays,
  shieldsCredited,
  onStartFocus,
}: SeasonPassCelebrationProps) {
  const t = useTranslations("CHALLENGE_CARD_COPY");
  const hub = useTranslations("HUB_LITE_COPY");

  return (
    <div
      className="season-pass-celebration"
      data-testid="season-pass-celebration"
    >
      {/* Anchored to the baked-in shield so the burst emanates from it. */}
      <div className="season-pass-celebration-burst">
        <ConfettiBurst />
      </div>

      <h2 className="season-pass-celebration-title">{t("celebrationTitle")}</h2>
      <p className="season-pass-celebration-subtitle">{t("celebrationSubtitle")}</p>

      <div className="season-pass-celebration-stats" data-testid="season-pass-celebration-stats">
        <span className="season-pass-celebration-stat">
          <CalendarIcon />
          {t("celebrationDaysStat", { days: durationDays })}
        </span>
        <span className="season-pass-celebration-stat-sep" aria-hidden="true" />
        <span className="season-pass-celebration-stat">
          <ShieldIcon />
          {shieldsCredited > 0
            ? t("celebrationShieldsStat", { count: shieldsCredited })
            : t("celebrationShieldsPending")}
        </span>
      </div>

      <p className="season-pass-celebration-habit">{t("celebrationHabit")}</p>

      <div className="season-pass-celebration-cta">
        {/* eslint-disable-next-line jsx-a11y/aria-unsupported-elements */}
        <picture className="season-pass-celebration-avatar" aria-hidden="true">
          <source srcSet="/art/new-assets-chesscito/fun/avatar-feliz.avif" type="image/avif" />
          <source srcSet="/art/new-assets-chesscito/fun/avatar-feliz.webp" type="image/webp" />
          <img src="/art/new-assets-chesscito/fun/avatar-feliz.png" alt="" draggable={false} />
        </picture>
        <button
          type="button"
          className="hub-lite-start-focus"
          data-testid="season-pass-start-focus"
          aria-label={hub("startFocusAriaLabel")}
          onClick={onStartFocus}
        >
          {hub("startFocus")}
        </button>
      </div>
    </div>
  );
}
