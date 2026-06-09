/**
 * useRetryGuard — Sprint 5 commit D (2026-06-08).
 *
 * Wraps the "Retry unlocked" outcome from `PeonesRetryButton` with
 * an attempt-scoped guard so the reset + increment chain runs
 * EXACTLY ONCE per attemptSeq, even when:
 *
 *   - the user double-taps the button
 *   - the RPC returns `duplicate=true` on a re-issued spend
 *   - the consumer re-renders and the callback ref fires again
 *
 * Without this guard, a duplicate idempotent response would call
 * `resetBoard()` + `incrementAttemptSeq()` AGAIN for the same
 * attempt, advancing the counter to N+2 and wiping fresh-attempt
 * state the user already started building. The guard collapses
 * those edge cases to a single, deterministic transition.
 *
 * Returns a memoised `onRetryUnlocked` callback safe to pass to
 * `<PeonesRetryButton onRetryUnlocked={...} />`. The internal ref
 * resets implicitly when attemptSeq advances (a new attempt is a
 * new key, so the dedup gate opens for it).
 */

import { useCallback, useRef } from "react";

export type UseRetryGuardArgs = {
  /** Current attempt being closed. Sourced from
   *  `useExerciseProgress().attemptSeq` so the parent owns the
   *  state of record. */
  attemptSeq: number;
  /** Caller-supplied reset routine (e.g. `resetBoard()` in
   *  exercises-screen.tsx). Runs FIRST so the board lands in its
   *  fresh state before the counter advances. */
  resetBoard: () => void;
  /** Caller-supplied increment routine, normally
   *  `useExerciseProgress().incrementAttemptSeq`. Runs AFTER reset
   *  so any consumer reading the new attemptSeq is reading a value
   *  for a board that is already in its fresh state. */
  incrementAttemptSeq: () => void;
  /** Sprint 5 commit F — optional post-transition hook. Fires INSIDE
   *  the dedup gate, AFTER reset + increment have run, so it is
   *  guaranteed to fire exactly once per applied retry. The exercise
   *  screen uses this to emit `training_retry_completed` without
   *  having to re-derive whether the transition actually applied.
   *  Receives the attemptSeq that was just closed (i.e. the value the
   *  guard read BEFORE incrementing) so the event payload describes
   *  the attempt the user paid for, not the new in-flight one.
   *
   *  Sprint 6 commit C (2026-06-08) — also receives the `source`
   *  string the caller passed when invoking the returned callback,
   *  so the consumer can distinguish trigger origins (manual RETRY
   *  tap vs failure-phase auto-reset) without holding two parallel
   *  guards with two dedup refs. */
  onApplied?: (closedAttemptSeq: number, source: string) => void;
};

/** Default source label when the consumer invokes the returned
 *  callback without arguments. Kept stable so the existing manual-
 *  retry-tap callsite continues to emit the same telemetry shape
 *  it has since Sprint 5 commit G. */
const DEFAULT_RETRY_SOURCE = "contextual_action_slot";

export function useRetryGuard({
  attemptSeq,
  resetBoard,
  incrementAttemptSeq,
  onApplied,
}: UseRetryGuardArgs): (source?: string) => void {
  /** The last attemptSeq we successfully transitioned. When the
   *  same value comes through again (double-tap / duplicate / re-
   *  render / auto-reset-after-manual-tap or vice versa) we no-op;
   *  when a different value arrives (legitimate fresh attempt) we
   *  run the transition. */
  const lastAppliedRef = useRef<number | null>(null);

  return useCallback(
    (source: string = DEFAULT_RETRY_SOURCE) => {
      if (lastAppliedRef.current === attemptSeq) return;
      lastAppliedRef.current = attemptSeq;
      resetBoard();
      incrementAttemptSeq();
      onApplied?.(attemptSeq, source);
    },
    [attemptSeq, resetBoard, incrementAttemptSeq, onApplied],
  );
}
