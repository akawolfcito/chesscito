/**
 * The two clocks of a duel, as pure functions (spec §Relojes).
 *
 * 1. The INVITATION — 1 h. How long the link lives before anyone sits down.
 *    Running out is not a defeat: the duel goes to `expired` with no winner.
 * 2. The GAME — a chess clock PER SEAT. The bank of the seat on move runs.
 *
 * ⚠️ The server charges with ITS clock. The client interpolates its own display
 * from `lastMoveAt`, but its count never enters here: every function below is a
 * function of the two server stamps it is given.
 *
 * ⛔ The flag falls ON READ, with the same mechanism as the invitation: if a
 * player walks away and never moves again, no event fires — the next GET
 * materializes it. No cron, no job.
 */

import { opponentOf, type DuelColor, type DuelOutcome } from "./types";

/**
 * The rungs of the ladder.
 *
 * ⛔ THE FLOOR IS 3 MINUTES, and it was raised from 30 seconds after the first
 * real playtest (founder, 2026-08-15). The reason is measured, not aesthetic:
 * the clock starts when the second player sits down, but the player on move
 * only finds out on their next poll and then watches the 1.8s matchup screen.
 * That is a handful of seconds nobody spent thinking, and it comes out of their
 * bank. At 30 seconds it is a quarter of the game; at 3 minutes it is under 2%.
 *
 * ⚠️ The table still accepts the original seven (`initial_minutes in (0.5, 1,
 * 3, 5, 10, 15, 30)`), and that is fine: the CHECK is there to refuse absurd
 * values, not to encode the product's current taste. Narrowing here narrows the
 * product; the constraint stays a ceiling on nonsense.
 */
export const CLOCK_LADDER_MINUTES = [3, 5, 10, 15, 30] as const;

export type ClockMinutes = (typeof CLOCK_LADDER_MINUTES)[number];

export const DEFAULT_CLOCK_MINUTES: ClockMinutes = 10;

/** The invitation lives one hour. */
export const INVITATION_TTL_MS = 60 * 60 * 1000;

/**
 * ⛔ The ladder is the whole validation of the create route: two buttons on a
 * phone, nothing to type, and no way to ask for an absurd amount of time.
 */
export function isClockMinutes(value: unknown): value is ClockMinutes {
  return (CLOCK_LADDER_MINUTES as readonly unknown[]).includes(value);
}

/** One press of `−` / `+`. Clamps at both ends rather than wrapping around. */
export function clockStep(current: ClockMinutes, direction: -1 | 1): ClockMinutes {
  const index = CLOCK_LADDER_MINUTES.indexOf(current);
  const next = index + direction;
  if (next < 0 || next >= CLOCK_LADDER_MINUTES.length) return current;
  return CLOCK_LADDER_MINUTES[next];
}

export function initialRemainingMs(minutes: ClockMinutes): number {
  return Math.round(minutes * 60 * 1000);
}

export type ClockCharge = {
  remainingMs: number;
  /** ⚠️ An exactly empty bank is a fallen flag, not "zero left and still playing". */
  flagged: boolean;
};

/**
 * Charge `now − lastMoveAt` to a seat's bank.
 *
 * - `lastMoveAt === null` (the game has no stamp yet) charges nothing.
 * - A stamp in the future — clock skew between server instances — charges
 *   nothing either. Time is never handed back.
 */
export function chargeClock(
  remainingMs: number,
  lastMoveAt: string | null,
  now: number,
): ClockCharge {
  const elapsed = elapsedSince(lastMoveAt, now);
  const left = Math.max(0, remainingMs - elapsed);
  return { remainingMs: left, flagged: left <= 0 };
}

export type FlagResolution = ClockCharge & {
  /** The win for the other seat once the flag is down; `null` while time is left. */
  outcome: DuelOutcome | null;
};

/**
 * The same charge, plus the rule attached to it: whoever runs out of their OWN
 * time loses, and the other seat wins. Behaviour 15 of the spec.
 */
export function resolveFlag(
  seatOnMove: DuelColor,
  remainingMs: number,
  lastMoveAt: string | null,
  now: number,
): FlagResolution {
  const charged = chargeClock(remainingMs, lastMoveAt, now);
  return {
    ...charged,
    outcome: charged.flagged
      ? { kind: "timeout", winner: opponentOf(seatOnMove) }
      : null,
  };
}

/** `expiresAt` is always compared against the SERVER clock. */
export function isInvitationExpired(expiresAt: string, now: number): boolean {
  const deadline = Date.parse(expiresAt);
  if (Number.isNaN(deadline)) return false;
  return now >= deadline;
}

function elapsedSince(stamp: string | null, now: number): number {
  if (stamp === null) return 0;
  const from = Date.parse(stamp);
  if (Number.isNaN(from)) return 0;
  return Math.max(0, now - from);
}
