"use client";

import { useCallback, useRef, useState } from "react";
import {
  getStreakNudgeState,
  recordStreakNudgeOwed,
  recordStreakNudgeShown,
  retireStreakNudge,
  shouldShowStreakNudge,
} from "./streak-nudge";
import { isStreakNudgeEnabled } from "@/lib/feature-flags";

export type UseStreakNudgeOptions = {
  /** UTC "YYYY-MM-DD". Passed in so the caller owns the clock. */
  today: string;
  /** `isCompletedToday()`. Read fresh by the caller on each render. */
  dailySolvedToday: boolean;
  /** True when a celebration or any other overlay already holds the screen.
   *  By construction this is nearly always false at an exit, but behavior 9
   *  of the spec asserts it rather than assuming it. */
  isOverlayOpen: boolean;
  /** Navigate to today's Daily Tactic. */
  onOpenDaily: () => void;
};

export type UseStreakNudgeResult = {
  visible: boolean;
  /** Call on every FRESH solve with the day's running count. Silent by
   *  design: arming renders nothing and blocks nothing. */
  armOnSolve: (freshSolvesToday: number) => void;
  /** Wrap any exit from the exercise flow. Returns true when the exit was
   *  DEFERRED (the screen took over); false when it ran straight through. */
  interceptExit: (exit: () => void) => boolean;
  /** Close, count the appearance, and complete the deferred navigation. */
  handleDismiss: () => void;
  /** Close, retire, and go to the Daily. The deferred exit is DROPPED: the
   *  player asked for a different destination than the one they were headed
   *  to, and running both would navigate twice. */
  handleOpenDaily: () => void;
};

/**
 * Owns the two moments of the daily-streak nudge inside the exercise flow.
 *
 * Arming happens on a solve and is invisible. Paying happens on the way out,
 * where the screen's ask ("do the Daily") is the same class of decision the
 * player is already making. Keeping them apart is the whole point: the 3rd
 * victory is the busiest celebration instant in LEARN.
 */
export function useStreakNudge({
  today,
  dailySolvedToday,
  isOverlayOpen,
  onOpenDaily,
}: UseStreakNudgeOptions): UseStreakNudgeResult {
  const [visible, setVisible] = useState(false);
  const deferredExit = useRef<(() => void) | null>(null);

  const armOnSolve = useCallback(
    (freshSolvesToday: number) => {
      if (!isStreakNudgeEnabled()) return;
      recordStreakNudgeOwed({ today, dailySolvedToday, freshSolvesToday });
    },
    [today, dailySolvedToday],
  );

  const interceptExit = useCallback(
    (exit: () => void) => {
      if (!isStreakNudgeEnabled() || isOverlayOpen) {
        exit();
        return false;
      }
      const owed = shouldShowStreakNudge({
        state: getStreakNudgeState(),
        today,
        dailySolvedToday,
      });
      if (!owed) {
        exit();
        return false;
      }
      deferredExit.current = exit;
      setVisible(true);
      return true;
    },
    [today, dailySolvedToday, isOverlayOpen],
  );

  const handleDismiss = useCallback(() => {
    setVisible(false);
    recordStreakNudgeShown(today);
    const exit = deferredExit.current;
    deferredExit.current = null;
    // "Tap to continue" has to mean continue to where they were going.
    exit?.();
  }, [today]);

  const handleOpenDaily = useCallback(() => {
    setVisible(false);
    retireStreakNudge(today);
    deferredExit.current = null;
    onOpenDaily();
  }, [today, onOpenDaily]);

  return { visible, armOnSolve, interceptExit, handleDismiss, handleOpenDaily };
}
