"use client";

import { useTranslations } from "next-intl";

import { CalendarIcon, ShieldIcon } from "@/components/hub/challenge-card";
import { ConfettiBurst } from "@/components/redesign/confetti-burst";
import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";

/** Full-panel art (frame + shield + ribbon + garden baked in). Consumed by the
 *  shell as the panel background, replacing `panel-bg1`. */
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
        <ThemeAssetPicture
          slot="shared.feedback-happy"
          pictureClassName="season-pass-celebration-avatar"
          pictureProps={{ "aria-hidden": true }}
          alt=""
          draggable={false}
        />
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
