"use client";

import { useTranslations } from "next-intl";

import {
  PASSPORT_TOTAL_SLOTS,
  passportFilledSlots,
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
   *  (no filled slots) to avoid hydration flicker / false days. */
  isLoading: boolean;
};

/** Focus Passport card (Chesscito Lite P1). Presentational only: streak +
 *  7 slots derived from the streak count (NOT calendar dates). No
 *  localStorage access here — the parent hydrates and passes props. Copy
 *  avoids verified/on-chain/proof/NFT/mint and any health claim. */
export function FocusPassport({
  streak,
  totalCompleted,
  todayDone,
  isLoading,
}: FocusPassportProps) {
  const t = useTranslations("FOCUS_PASSPORT_COPY");

  const filledSlots = isLoading ? 0 : passportFilledSlots(streak);
  const tier = isLoading ? "empty" : passportTier(streak);

  let title: string;
  let sub: string;
  if (isLoading) {
    title = t("heading");
    sub = t("loading");
  } else if (tier === "empty") {
    title = t("emptyTitle");
    sub = t("emptySub");
  } else if (tier === "day1") {
    title = t("day1Title");
    sub = t("day1Sub");
  } else if (tier === "week") {
    title = t("weekTitle");
    sub = t("weekSub");
  } else {
    title = t("buildingTitle", { count: streak });
    sub = t("buildingSub");
  }

  // The slot representing "today": the most recent filled slot when today
  // is done, otherwise the next slot is the still-pending one (only when a
  // streak is live, not in the empty state).
  const todaySlotIndex =
    !isLoading && todayDone && filledSlots > 0
      ? filledSlots - 1
      : !isLoading && !todayDone && tier !== "empty" && filledSlots < PASSPORT_TOTAL_SLOTS
        ? filledSlots
        : -1;

  return (
    <section
      className="focus-passport"
      aria-label={t("rootAriaLabel")}
      aria-busy={isLoading || undefined}
      data-total-completed={totalCompleted}
      data-testid="focus-passport"
    >
      <div className="focus-passport-head">
        <p className="focus-passport-title" data-testid="focus-passport-title">
          {title}
        </p>
        <p className="focus-passport-sub">{sub}</p>
      </div>
      <div className="focus-passport-slots" role="list">
        {Array.from({ length: PASSPORT_TOTAL_SLOTS }, (_, i) => {
          const filled = i < filledSlots;
          const isToday = i === todaySlotIndex;
          const dayLabel = i + 1;
          return (
            <span
              key={i}
              role="listitem"
              data-testid="focus-passport-slot"
              data-filled={filled || undefined}
              data-today={isToday || undefined}
              aria-label={
                filled
                  ? t("slotFilledAria", { index: dayLabel })
                  : t("slotEmptyAria", { index: dayLabel })
              }
              className={`focus-passport-slot${filled ? " is-filled" : ""}${
                isToday ? " is-today" : ""
              }`}
            />
          );
        })}
      </div>
      <p className="focus-passport-foot">{t("currentStreak")}</p>
    </section>
  );
}
