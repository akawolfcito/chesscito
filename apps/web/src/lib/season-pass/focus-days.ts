/**
 * Focus Days — the challenge counter, as a pure module.
 *
 * Spec: docs/specs/2026-07-27-focus-days-ledger.md (APPROVED 2026-07-27).
 *
 * The card used to render `min(streak, 21)` as "Day N of 21". Streak resets to
 * 1 on a missed day, so that number went BACKWARD, and the pass expired by wall
 * clock regardless. Three questions were sharing one number. They are separated
 * here: progress is what you earned, the window is how long you have, and the
 * streak stays where it always was.
 *
 * Everything in this file is pure. Persistence, entitlement and the clock enter
 * as arguments, never as reads.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Distinct UTC dates completed inside the active season, already clamped. */
export type FocusDaysProgress = { completed: number; goal: number };

/** `unbounded` is PRO: access with no season deadline, so no countdown and
 *  nothing that can become unreachable. */
export type FocusWindow =
  | { kind: "expiring"; daysRemaining: number }
  | { kind: "unbounded" };

/** What the status endpoint reports about the ledger. `disabled` (kill switch)
 *  and `unavailable` (ledger down) are kept apart on purpose: one is a choice,
 *  the other is a failure, and they must not render the same. */
export type FocusDaysSlice =
  | { status: "disabled" }
  | { status: "unavailable" }
  | { status: "ok"; completed: number; goal: number; seasonId: string };

export type ChallengeProgressView =
  | { state: "loading" }
  | { state: "offer" }
  /** Sales are paused: the pass is not for sale right now, so the card
   *  offers nothing. Distinct from "offer" (buyable) and from the active
   *  states, which a paused sale must never touch.
   *
   *  ⚠️ `pending` SEPARATES "there is no challenge" FROM "I do not know yet".
   *  Both render the habit-only panel — never the paused offer — but only the
   *  resolved one may collapse the card's layout. While pending, an entitled
   *  player's counter and deadline are still on their way, and dropping their
   *  slots makes the card jump when the answer lands. Measured 2026-08-27:
   *  11 people hold an active pass and hit exactly this path on a cold load. */
  | { state: "unavailable"; pending?: boolean }
  | { state: "disabled"; window: FocusWindow; streak: number }
  | { state: "degraded"; window: FocusWindow; streak: number }
  | {
      state: "active";
      progress: FocusDaysProgress;
      window: FocusWindow;
      streak: number;
      unreachable: boolean;
    }
  | {
      state: "completed";
      progress: FocusDaysProgress;
      window: FocusWindow;
      streak: number;
    };

/** UTC day number. Floor of the epoch day, so two instants on the same UTC date
 *  always land on the same integer regardless of time of day. */
function utcDayIndex(ms: number): number {
  return Math.floor(ms / DAY_MS);
}

function parseUtcDate(date: string): number {
  return Date.parse(`${date}T00:00:00.000Z`);
}

function formatUtcDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function focusDaysProgress(completedRows: number, goal: number): FocusDaysProgress {
  if (!Number.isFinite(completedRows)) return { completed: 0, goal };
  return { completed: Math.min(Math.max(Math.trunc(completedRows), 0), goal), goal };
}

/** True when fewer days remain than days still owed. PRO can never be
 *  unreachable (no deadline), and a met goal is never unreachable either. */
export function isUnreachable(progress: FocusDaysProgress, window: FocusWindow): boolean {
  if (window.kind === "unbounded") return false;
  const owed = progress.goal - progress.completed;
  if (owed <= 0) return false;
  return owed > window.daysRemaining;
}

/**
 * Days the pass has already been alive, counting the purchase day as day 1.
 * The ceiling for any backfill: nobody can have trained on more days than their
 * pass has existed. Zero when the expiry is missing or unparseable, because
 * then nothing can be inferred at all.
 */
export function elapsedEligibleDays(
  expiresAt: string | null | undefined,
  durationDays: number,
  now: number = Date.now(),
): number {
  if (!expiresAt) return 0;
  const expiryMs = Date.parse(expiresAt);
  if (Number.isNaN(expiryMs)) return 0;

  const windowStartMs = expiryMs - durationDays * DAY_MS;
  const elapsed = utcDayIndex(now) - utcDayIndex(windowStartMs) + 1;
  return Math.min(Math.max(elapsed, 0), durationDays);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Whether a completion may be recorded for `date`.
 *
 * The endpoint is not an arbitrary registrar of history: the only dates it
 * accepts are today and yesterday, and only inside an entitlement that was
 * already live on that date. Everything else is somebody's clock being wrong,
 * or somebody trying.
 *
 * PRO is evaluated differently on purpose. It has no purchased window, so
 * "after the start" and "before the expiry" have nothing to compare against;
 * what survives is that PRO had not already lapsed when that day began.
 */
export function isEligibleFocusDate(input: {
  date: string;
  now: number;
  source: "pro" | "season_pass";
  /** First UTC date of the purchased window. `null` for PRO. */
  windowStartUtc: string | null;
  /** Pass expiry, ISO. `null` for PRO. */
  expiresAt: string | null;
  proExpiresAt: number | null;
}): boolean {
  const { date, now, source, windowStartUtc, expiresAt, proExpiresAt } = input;

  if (!DATE_RE.test(date)) return false;
  const dateMs = parseUtcDate(date);
  if (Number.isNaN(dateMs)) return false;
  // Guards against a well-formed impossibility like 2026-13-40, which
  // Date.parse rolls over instead of rejecting.
  if (formatUtcDate(dateMs) !== date) return false;

  const todayIndex = utcDayIndex(now);
  const dayIndex = utcDayIndex(dateMs);
  if (dayIndex !== todayIndex && dayIndex !== todayIndex - 1) return false;

  if (source === "pro") {
    return proExpiresAt !== null && proExpiresAt >= dateMs;
  }

  if (!windowStartUtc || !expiresAt) return false;
  const expiryMs = Date.parse(expiresAt);
  if (Number.isNaN(expiryMs)) return false;
  if (dateMs < parseUtcDate(windowStartUtc)) return false;
  return dateMs <= expiryMs;
}

/**
 * The UTC date the pass opened, derived from its expiry. `null` when there is
 * no expiry: PRO has access without a purchased window, and inventing a start
 * for it would fabricate history.
 */
export function passWindowStartUtc(
  expiresAt: string | null | undefined,
  durationDays: number,
): string | null {
  if (!expiresAt) return null;
  const expiryMs = Date.parse(expiresAt);
  if (Number.isNaN(expiryMs)) return null;
  return formatUtcDate(expiryMs - durationDays * DAY_MS);
}

/**
 * The one-shot seed for players who already owned a pass when this shipped.
 *
 * Inferred, not observed: `reportedStreak` comes from the client's
 * localStorage and is editable. That is accepted deliberately — it preserves
 * continuity of UX for someone who already paid and grants no economic value.
 * Rows land tagged `backfill_streak` so any future system can exclude them.
 *
 * Three independent ceilings, all applied: the streak claimed, the days the
 * pass has lived, and the goal. Plus two hard boundaries: nothing before the
 * pass opened, nothing after today.
 */
export function backfillDates(input: {
  reportedStreak: number;
  lastCompletedDate: string | null;
  elapsed: number;
  goal: number;
  windowStartUtc: string;
  todayUtc: string;
}): string[] {
  const { reportedStreak, lastCompletedDate, elapsed, goal, windowStartUtc, todayUtc } = input;
  if (!lastCompletedDate || reportedStreak <= 0) return [];

  const count = Math.min(Math.trunc(reportedStreak), elapsed, goal);
  if (count <= 0) return [];

  // A run can never end in the future: a client clock ahead of the server must
  // not mint days that have not happened.
  const anchorMs = Math.min(parseUtcDate(lastCompletedDate), parseUtcDate(todayUtc));
  if (Number.isNaN(anchorMs)) return [];
  const windowStartMs = parseUtcDate(windowStartUtc);

  const dates: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const ms = anchorMs - i * DAY_MS;
    if (ms < windowStartMs) continue;
    dates.push(formatUtcDate(ms));
  }
  return dates;
}

/** Assembles the view the card renders. The streak enters as a sibling metric
 *  and is NEVER used to stand in for `completed`: showing a number that can go
 *  backward is exactly the defect this replaces. */
export function challengeProgressView(input: {
  slice: FocusDaysSlice;
  window: FocusWindow;
  streak: number;
}): ChallengeProgressView {
  const { slice, window, streak } = input;

  if (slice.status === "disabled") return { state: "disabled", window, streak };
  if (slice.status === "unavailable") return { state: "degraded", window, streak };

  const progress = focusDaysProgress(slice.completed, slice.goal);
  if (progress.completed >= progress.goal) {
    return { state: "completed", progress, window, streak };
  }
  return {
    state: "active",
    progress,
    window,
    streak,
    unreachable: isUnreachable(progress, window),
  };
}
