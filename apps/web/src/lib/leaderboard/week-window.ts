/**
 * The weekly leaderboard's window (Slice 2B).
 *
 * Spec: docs/specs/2026-07-29-leaders-weekly-api.md
 * Parent (why the interval is half-open): docs/specs/2026-07-29-leaders-weekly-window-v2.md
 *
 * One shared calendar week in UTC — no per-player timezone and no rolling
 * window, so every player is ranked over the same seven days and the board
 * resets for everyone at the same instant.
 */

/** Half-open UTC week window. `end` is exclusive. */
export type WeekWindow = {
  /** Monday 00:00:00.000 UTC, at or before `now`. */
  start: Date;
  /** The following Monday 00:00:00.000 UTC. Exclusive bound. */
  end: Date;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Pure. `now` is always injected — no clock access — so the boundary cases are
 * ordinary assertions instead of clock mocking, in the test runner or in
 * Postgres.
 *
 * Every reader is a UTC getter. A local-time implementation would put the same
 * instant in different weeks depending on where the server runs, and it would
 * do so only twice a year, at the DST switch.
 */
export function currentWeekWindow(now: Date): WeekWindow {
  // getUTCDay(): Sunday = 0 … Monday = 1. Sunday must map back six days, not
  // forward one, because it is the LAST day of its week.
  const daysSinceMonday = (now.getUTCDay() + 6) % 7;

  const start = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - daysSinceMonday,
    ),
  );

  // Adding 7 * DAY_MS rather than setting the date component: Date.UTC has no
  // DST to trip over, and this keeps `end - start` exactly one week in the
  // arithmetic sense the SQL half-open bound relies on.
  return { start, end: new Date(start.getTime() + 7 * DAY_MS) };
}
