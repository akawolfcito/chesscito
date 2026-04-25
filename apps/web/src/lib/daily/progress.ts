/**
 * Daily Tactic — streak + completion progress persisted in localStorage.
 *
 * Streak rules:
 * - Completing today's tactic when lastCompletedDate is yesterday → streak + 1
 * - Completing today's tactic when lastCompletedDate is older     → streak = 1 (reset)
 * - Completing today's tactic when lastCompletedDate is today     → no-op
 *
 * Dates are normalized to UTC "YYYY-MM-DD" so the rotation matches the
 * puzzle of the day across devices. Pure helpers below accept an
 * explicit `today` argument so tests can pin the clock.
 */

const STORAGE_KEY = "chesscito:daily-progress";

export type DailyProgress = {
  streak: number;
  lastCompletedDate: string | null;
  totalCompleted: number;
};

const DEFAULT_PROGRESS: DailyProgress = {
  streak: 0,
  lastCompletedDate: null,
  totalCompleted: 0,
};

/** Returns the UTC date in "YYYY-MM-DD" form. */
export function todayUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Returns the previous UTC day for a "YYYY-MM-DD" string. */
export function yesterdayUtc(today: string): string {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function isValidDateString(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseProgress(raw: unknown): DailyProgress {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...DEFAULT_PROGRESS };
  const obj = raw as Record<string, unknown>;
  const streak = typeof obj.streak === "number" && obj.streak >= 0 ? Math.floor(obj.streak) : 0;
  const lastCompletedDate = isValidDateString(obj.lastCompletedDate) ? obj.lastCompletedDate : null;
  const totalCompleted =
    typeof obj.totalCompleted === "number" && obj.totalCompleted >= 0
      ? Math.floor(obj.totalCompleted)
      : 0;
  return { streak, lastCompletedDate, totalCompleted };
}

/** Reads progress from localStorage, returning defaults on miss/corruption. */
export function getDailyProgress(): DailyProgress {
  if (typeof window === "undefined") return { ...DEFAULT_PROGRESS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROGRESS };
    return parseProgress(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_PROGRESS };
  }
}

/** Pure helper: computes the next progress state given a completion event. */
export function computeNextProgress(prev: DailyProgress, today: string): DailyProgress {
  if (prev.lastCompletedDate === today) return prev;
  const wasYesterday = prev.lastCompletedDate === yesterdayUtc(today);
  return {
    streak: wasYesterday ? prev.streak + 1 : 1,
    lastCompletedDate: today,
    totalCompleted: prev.totalCompleted + 1,
  };
}

/** Records a completion for `today` (defaults to today UTC). Persists and
 *  returns the updated state. No-op if already completed today. */
export function recordDailyCompletion(today: string = todayUtc()): DailyProgress {
  const prev = getDailyProgress();
  const next = computeNextProgress(prev, today);
  if (next === prev) return prev;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Quota or privacy mode — keep returning the in-memory next state
      // so the UI still reflects the completion for this session.
    }
  }
  return next;
}

/** True when today's tactic is already done. Cheap UI guard. */
export function isCompletedToday(
  today: string = todayUtc(),
  progress: DailyProgress = getDailyProgress(),
): boolean {
  return progress.lastCompletedDate === today;
}

/** True when the player still has a live streak (last completion is today
 *  or yesterday). Useful for showing the flame icon vs grayed-out state. */
export function isStreakLive(
  today: string = todayUtc(),
  progress: DailyProgress = getDailyProgress(),
): boolean {
  if (progress.streak === 0 || !progress.lastCompletedDate) return false;
  return progress.lastCompletedDate === today || progress.lastCompletedDate === yesterdayUtc(today);
}
