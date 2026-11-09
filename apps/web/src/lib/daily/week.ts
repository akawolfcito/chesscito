/**
 * Focus Passport — the current UTC week, Monday-first.
 *
 * Derived, NOT persisted. `DailyProgress` stores `{ streak, lastCompletedDate,
 * totalCompleted }` and no `completedDates[]`, so the only completions this
 * module can prove are the contiguous run of `streak` days ending at
 * `lastCompletedDate`. Everything else in the past reads as "missed".
 *
 * Known fidelity limit (accepted, founder 2026-07-25): a day completed BEFORE a
 * broken streak paints as "missed" — e.g. done Mon, skipped Tue, done Wed shows
 * Mon as missed because the live run is 1 day. Faithful for the common case (a
 * live streak); imprecise only after a break. Fixing it needs a real
 * `completedDates[]` in storage, which this slice deliberately does not add.
 *
 * There is NO `shield-protected` state here: per-day shield rescue is not
 * modelled anywhere in storage, and inventing it would show data we cannot back.
 *
 * All dates are UTC "YYYY-MM-DD" — the same clock `todayUtc()` uses, so the row
 * and the Daily always agree on what "today" is.
 */

/** A completion the run can prove, a miss, today, or a day not yet reached. */
export type FocusWeekDayState =
  | "completed"
  | "today-done"
  | "today-pending"
  | "missed"
  | "future";

export type FocusWeekDay = {
  /** UTC "YYYY-MM-DD". */
  date: string;
  /** 0 = Monday … 6 = Sunday (row order, not `getUTCDay()`). */
  index: number;
  state: FocusWeekDayState;
  isToday: boolean;
};

const DAYS_IN_WEEK = 7;

function shiftUtcDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Monday of the UTC week containing `date`. `getUTCDay()` puts Sunday at 0, so
 *  Sunday must land at the END of the row, not the start. */
function mondayOfUtcWeek(date: string): string {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  return shiftUtcDays(date, -((dow + 6) % DAYS_IN_WEEK));
}

/**
 * Builds the 7 Monday-first slots of the UTC week containing `today`.
 *
 * @param today  UTC "YYYY-MM-DD" (from `todayUtc()`).
 * @param streak Consecutive completed days (the Daily Streak).
 * @param lastCompletedDate Last completed UTC day, or null if never.
 */
export function focusWeek(
  today: string,
  streak: number,
  lastCompletedDate: string | null,
): FocusWeekDay[] {
  const monday = mondayOfUtcWeek(today);

  // The provable run: `runLength` days ending at `lastCompletedDate`. A
  // non-positive or non-finite streak proves nothing — never extrapolate.
  const runLength =
    lastCompletedDate && Number.isFinite(streak) ? Math.max(0, Math.floor(streak)) : 0;
  const runStart = runLength > 0 ? shiftUtcDays(lastCompletedDate!, -(runLength - 1)) : null;

  const inRun = (date: string) =>
    runStart !== null && date >= runStart && date <= lastCompletedDate!;

  return Array.from({ length: DAYS_IN_WEEK }, (_, index) => {
    const date = shiftUtcDays(monday, index);
    const isToday = date === today;
    const state: FocusWeekDayState = isToday
      ? inRun(date)
        ? "today-done"
        : "today-pending"
      : date > today
        ? "future"
        : inRun(date)
          ? "completed"
          : "missed";
    return { date, index, state, isToday };
  });
}
