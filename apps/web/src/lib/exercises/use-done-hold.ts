"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Matches the window the replaced effect used (3 × --duration-ceremony). */
export const SAVE_DONE_HOLD_MS = 1500;

export type UseDoneHoldReturn = {
  /** Epoch ms when the window opened; null outside the hold. */
  doneAt: number | null;
  /** Idempotent per key — a repeat start for the same tx does not restart the
   *  window. This carries the `doneHoldStartedForTxRef` latch. */
  start: (key: string) => void;
  /** Closes the window and clears the pending timer, so a stale timeout cannot
   *  null out a later window. Call when a NEW write begins. */
  reset: () => void;
};

/**
 * The post-confirmation hold that keeps `<TxProgressSteps>` mounted for a beat
 * after a save lands.
 *
 * Lifted out of `<ExercisesScreen>`, where it shared an effect with
 * `recordSaveFor` and a latch ref. That effect was keyed on
 * `useWaitForTransactionReceipt().isSuccess`, so it also ran for reverted
 * transactions. Separating the timer from the persistence let the persistence
 * move behind a real receipt check without losing the hold.
 */
export function useDoneHold(holdMs: number = SAVE_DONE_HOLD_MS): UseDoneHoldReturn {
  const [doneAt, setDoneAt] = useState<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const startedForKeyRef = useRef<string | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const start = useCallback(
    (key: string) => {
      if (startedForKeyRef.current === key) return;
      startedForKeyRef.current = key;

      clearTimer();
      setDoneAt(Date.now());
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        setDoneAt(null);
      }, holdMs);
    },
    [clearTimer, holdMs],
  );

  const reset = useCallback(() => {
    clearTimer();
    startedForKeyRef.current = null;
    setDoneAt(null);
  }, [clearTimer]);

  return { doneAt, start, reset };
}
