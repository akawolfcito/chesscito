/**
 * Daily-streak nudge — teaches the rule instead of changing it.
 *
 * The flame is lit ONLY by the Daily Tactic (`recordDailyCompletion`). That is
 * deliberate. The defect this module addresses is that the rule is invisible:
 * a player can solve ten exercises, feel they trained hard, and end the day
 * with a dark flame having never been told what the switch was.
 *
 * Two moments, never one:
 *  - ARMING is silent and happens on a fresh solve (`computeNudgeOwed`).
 *  - PAYING is visible and happens on the way OUT of the exercise flow
 *    (`shouldShowStreakNudge`).
 *
 * They are separate because the 3rd victory is the busiest celebration instant
 * in LEARN — `great-focus-session` + `first-great-session` fire there, and
 * `first-reward` lands on the 2nd or 3rd. A message that has to be *read*
 * cannot be the fourth card in that stack.
 *
 * Nothing here touches `DailyProgress`. Its nine readers are untouched.
 */

import { todayUtc } from "./progress";
import { isStreakNudgeEnabled } from "@/lib/feature-flags";
import { streakNudgeStorageKey } from "@/lib/lite-progress-storage";

/** Evaluated every Nth fresh solve. */
export const STREAK_NUDGE_EXERCISE_INTERVAL = 3;

/** Lifetime hard cap. After this the screen never renders again. */
export const STREAK_NUDGE_MAX_SHOWS = 3;

export type StreakNudgeState = {
  /** Lifetime appearances. Monotonic, clamped at STREAK_NUDGE_MAX_SHOWS on READ,
   *  so a corrupt record can never buy a 4th appearance. */
  shownCount: number;
  /** UTC "YYYY-MM-DD" of the last appearance. Enforces once-per-day. */
  lastShownDate: string | null;
  /** THE LATCH. The day an appearance was armed and not yet paid. A modulo
   *  test cannot survive being blocked — if the 3rd solve is a bad moment,
   *  `% 3` is false at 4 and 5 and the day teaches nothing. The latch waits. */
  owedForDate: string | null;
  /** Set when the player opened the Daily FROM this screen. The lesson landed;
   *  the screen retires for good instead of spending its remaining slots. */
  retired: boolean;
};

export type ComputeNudgeOwedInput = {
  today: string;
  /** `isCompletedToday()` — the EXISTING answer, not a new concept. */
  dailySolvedToday: boolean;
  /** `getUsedCount(getDailySession())` — the existing per-day ledger. */
  freshSolvesToday: number;
};

export type ShouldShowStreakNudgeInput = {
  state: StreakNudgeState;
  today: string;
  dailySolvedToday: boolean;
};

export const DEFAULT_STREAK_NUDGE_STATE: StreakNudgeState = {
  shownCount: 0,
  lastShownDate: null,
  owedForDate: null,
  retired: false,
};

/** Pure. Arms the latch. Called on every fresh solve — never renders anything. */
export function computeNudgeOwed(
  prev: StreakNudgeState,
  input: ComputeNudgeOwedInput,
): StreakNudgeState {
  const { today, dailySolvedToday, freshSolvesToday } = input;
  if (prev.retired) return prev;
  if (prev.shownCount >= STREAK_NUDGE_MAX_SHOWS) return prev;
  if (prev.lastShownDate === today) return prev;
  if (dailySolvedToday) return prev;
  // `0 % 3` is 0, so the interval test alone would arm a player who has solved
  // nothing. The premise of the screen is "you have been training".
  if (freshSolvesToday <= 0) return prev;
  if (freshSolvesToday % STREAK_NUDGE_EXERCISE_INTERVAL !== 0) return prev;
  if (prev.owedForDate === today) return prev;
  return { ...prev, owedForDate: today };
}

/** Pure. Pays the latch. Called when the player LEAVES the exercise flow.
 *  Deliberately blind to solve counts: by here the decision is already made. */
export function shouldShowStreakNudge(input: ShouldShowStreakNudgeInput): boolean {
  const { state, today, dailySolvedToday } = input;
  if (state.retired) return false;
  if (state.shownCount >= STREAK_NUDGE_MAX_SHOWS) return false;
  if (state.lastShownDate === today) return false;
  // Re-checked at pay time: a player who armed the latch and then solved the
  // Daily before leaving has already learned the rule by doing it.
  if (dailySolvedToday) return false;
  // Compared against today, never merely truthy. A debt armed on Monday must
  // not be paid on Tuesday, when the player has a fresh chance at the Daily
  // and the message would be about a day that is already lost.
  return state.owedForDate === today;
}

/** Pure. Idempotent within a day: returns `prev` by reference when
 *  `lastShownDate === today`, mirroring `computeNextProgress`. */
export function computeNudgeShown(prev: StreakNudgeState, today: string): StreakNudgeState {
  if (prev.lastShownDate === today) return prev;
  return {
    ...prev,
    shownCount: Math.min(prev.shownCount + 1, STREAK_NUDGE_MAX_SHOWS),
    lastShownDate: today,
    owedForDate: null,
  };
}

/** Pure. Retires the screen for good. Idempotent. */
export function computeNudgeRetired(prev: StreakNudgeState, today: string): StreakNudgeState {
  if (prev.retired) return prev;
  return { ...computeNudgeShown(prev, today), retired: true };
}

function isValidDateString(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseStreakNudge(raw: unknown): StreakNudgeState {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_STREAK_NUDGE_STATE };
  }
  const obj = raw as Record<string, unknown>;
  return {
    // Clamped on READ, not merely on write: a tampered or corrupt record must
    // never be able to buy a 4th appearance.
    shownCount:
      typeof obj.shownCount === "number" && obj.shownCount >= 0
        ? Math.min(Math.floor(obj.shownCount), STREAK_NUDGE_MAX_SHOWS)
        : 0,
    lastShownDate: isValidDateString(obj.lastShownDate) ? obj.lastShownDate : null,
    owedForDate: isValidDateString(obj.owedForDate) ? obj.owedForDate : null,
    retired: obj.retired === true,
  };
}

/** Reads state from localStorage. Never throws; a corrupt record fails toward
 *  the default, and the default fails toward showing. */
export function getStreakNudgeState(): StreakNudgeState {
  if (typeof window === "undefined") return { ...DEFAULT_STREAK_NUDGE_STATE };
  try {
    const raw = localStorage.getItem(streakNudgeStorageKey());
    if (!raw) return { ...DEFAULT_STREAK_NUDGE_STATE };
    return parseStreakNudge(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_STREAK_NUDGE_STATE };
  }
}

function persist(next: StreakNudgeState): StreakNudgeState {
  if (typeof window === "undefined") return next;
  try {
    localStorage.setItem(streakNudgeStorageKey(), JSON.stringify(next));
  } catch {
    // Quota or privacy mode. The exercise flow must not depend on this write;
    // worst case the screen re-appears next session.
  }
  return next;
}

/** Applies a pure transition and persists it, unless the flag is off — in
 *  which case the feature writes nothing at all. */
function commit(
  transition: (prev: StreakNudgeState) => StreakNudgeState,
): StreakNudgeState {
  const prev = getStreakNudgeState();
  if (!isStreakNudgeEnabled()) return prev;
  const next = transition(prev);
  if (next === prev) return prev;
  return persist(next);
}

/** Persists an appearance for `today`. Returns the updated state. */
export function recordStreakNudgeShown(today: string = todayUtc()): StreakNudgeState {
  return commit((prev) => computeNudgeShown(prev, today));
}

/** Persists the arming decision. Returns the updated state. */
export function recordStreakNudgeOwed(input: ComputeNudgeOwedInput): StreakNudgeState {
  return commit((prev) => computeNudgeOwed(prev, input));
}

/** Retires the screen permanently AND counts the appearance. Called when its
 *  CTA is taken: the player learned, so the screen stops. */
export function retireStreakNudge(today: string = todayUtc()): StreakNudgeState {
  return commit((prev) => computeNudgeRetired(prev, today));
}
