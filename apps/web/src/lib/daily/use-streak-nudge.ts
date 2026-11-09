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
  /** UTC "YYYY-MM-DD", read at CALL time. A getter, not a value: computing
   *  it during render would decide from state that may not be hydrated yet,
   *  and this module persists what it decides. */
  getToday: () => string;
  /** `isCompletedToday()`, read at CALL time for the same reason. Both
   *  handlers below run from events, never from render, so a getter costs
   *  nothing and removes the hydration hazard entirely. */
  isDailySolvedToday: () => boolean;
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
export function useStreakNudge(options: UseStreakNudgeOptions): UseStreakNudgeResult {
  const [visible, setVisible] = useState(false);
  const deferredExit = useRef<(() => void) | null>(null);
  // Latest options, so every returned handler keeps a stable identity and
  // still sees current values. The handlers only ever run from events.
  const latest = useRef(options);
  latest.current = options;

  const armOnSolve = useCallback((freshSolvesToday: number) => {
    if (!isStreakNudgeEnabled()) return;
    recordStreakNudgeOwed({
      today: latest.current.getToday(),
      dailySolvedToday: latest.current.isDailySolvedToday(),
      freshSolvesToday,
    });
  }, []);

  const interceptExit = useCallback((exit: () => void) => {
    if (!isStreakNudgeEnabled() || latest.current.isOverlayOpen) {
      exit();
      return false;
    }
    const owed = shouldShowStreakNudge({
      state: getStreakNudgeState(),
      today: latest.current.getToday(),
      dailySolvedToday: latest.current.isDailySolvedToday(),
    });
    if (!owed) {
      exit();
      return false;
    }
    deferredExit.current = exit;
    setVisible(true);
    return true;
  }, []);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    recordStreakNudgeShown(latest.current.getToday());
    const exit = deferredExit.current;
    deferredExit.current = null;
    // "Tap to continue" has to mean continue to where they were going.
    exit?.();
  }, []);

  const handleOpenDaily = useCallback(() => {
    setVisible(false);
    retireStreakNudge(latest.current.getToday());
    deferredExit.current = null;
    latest.current.onOpenDaily();
  }, []);

  return { visible, armOnSolve, interceptExit, handleDismiss, handleOpenDaily };
}
