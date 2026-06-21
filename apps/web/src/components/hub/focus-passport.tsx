"use client";

import { useTranslations } from "next-intl";

import {
  type PassportSlotKind,
  passportSlots,
  passportTier,
} from "@/lib/daily/passport";

export type FocusPassportProps = {
  /** Current consecutive-day streak (from `chesscito:daily-progress`). */
  streak: number;
  /** Lifetime solved-daily count. Accepted for telemetry/parity; not
   *  rendered as copy in P1 (kept off-screen to avoid new claims). */
  totalCompleted: number;
  /** True when today's focus is already solved. */
  todayDone: boolean;
  /** While the parent hydrates localStorage, render the safe empty shell
   *  (all-gray flames) to avoid hydration flicker / false days. */
  isLoading: boolean;
};

/** Flame sprite basenames in `public/art/focus-passport/`. */
const FLAME_ASSET: Record<PassportSlotKind, string> = {
  color: "flame-color",
  blue: "flame-blue",
  gray: "flame-gray",
};

/** Focus Passport card (Chesscito Lite, P1.1 visual iteration).
 *  Compact, icon-first: 7 flames read as a streak (frozen-blue = earlier
 *  day done, orange-gold = today/active done, gray = pending). Slots are
 *  derived purely from the streak count (NOT calendar dates). No
 *  localStorage access here — the parent hydrates and passes props. Copy
 *  avoids verified/on-chain/proof/NFT/mint and any health claim. */
export function FocusPassport({
  streak,
  totalCompleted,
  todayDone,
  isLoading,
}: FocusPassportProps) {
  const t = useTranslations("FOCUS_PASSPORT_COPY");

  // While loading, force the safe empty shell (all gray, no glow, no
  // dynamic title) so the server + first client render never paint false
  // filled days.
  const slots = isLoading
    ? passportSlots(0, false).map((s) => ({ ...s, glow: false }))
    : passportSlots(streak < 0 ? 0 : streak, todayDone);
  const tier = isLoading ? "empty" : passportTier(streak);

  // No title in the empty/loading state — "Start your streak" added noise
  // in the center-stack placement, so the empty passport is flames-only
  // under the subtle kicker. Day1/building/week keep their streak title.
  let title = "";
  if (!isLoading) {
    if (tier === "day1") title = t("day1Title");
    else if (tier === "week") title = t("weekTitle");
    else if (tier === "building") title = t("buildingTitle", { count: streak });
  }

  return (
    <section
      className="focus-passport"
      aria-label={t("rootAriaLabel")}
      aria-busy={isLoading || undefined}
      data-total-completed={totalCompleted}
      data-testid="focus-passport"
    >
      <p className="focus-passport-kicker">{t("heading")}</p>
      <div className="focus-passport-slots" role="list">
        {slots.map((slot, i) => {
          const filled = slot.kind !== "gray";
          const asset = FLAME_ASSET[slot.kind];
          const dayLabel = i + 1;
          return (
            <picture
              key={i}
              role="listitem"
              data-testid="focus-passport-slot"
              data-kind={slot.kind}
              data-filled={filled || undefined}
              data-glow={slot.glow || undefined}
              className={`focus-passport-slot focus-passport-slot--${slot.kind}${
                slot.glow ? " is-glow" : ""
              }`}
            >
              <source srcSet={`/art/focus-passport/${asset}.avif`} type="image/avif" />
              <source srcSet={`/art/focus-passport/${asset}.webp`} type="image/webp" />
              <img
                src={`/art/focus-passport/${asset}.png`}
                alt={
                  filled
                    ? t("slotFilledAria", { index: dayLabel })
                    : t("slotEmptyAria", { index: dayLabel })
                }
                draggable={false}
              />
            </picture>
          );
        })}
      </div>
      {title ? (
        <p className="focus-passport-title" data-testid="focus-passport-title">
          {title}
        </p>
      ) : null}
    </section>
  );
}
