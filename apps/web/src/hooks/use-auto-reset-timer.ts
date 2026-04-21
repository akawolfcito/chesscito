"use client";

import { useEffect, useRef } from "react";

/**
 * Auto-reset timer with generation-based stale-callback protection.
 *
 * The play-hub fires a single auto-reset timer in several spots
 * (success → advance, failure → restart, badge-earned safety-net).
 * All of them share the same invariants:
 *   - Only one timer may be pending at a time.
 *   - If the user navigates mid-timer (changes piece, jumps to a
 *     different exercise), the scheduled callback MUST NOT fire.
 *   - Must clean up on unmount.
 *
 * Before this hook those invariants were spread across 8 call sites
 * in page.tsx (`autoResetTimer.current` + a separate
 * `boardGeneration.current` ref + a cleanup effect). This collapses
 * all of it into a small API.
 *
 * API:
 *   schedule(cb, ms)  → replaces any pending timer, captures the
 *                        current generation, fires cb only if the
 *                        generation is still current at firing time.
 *   clear()           → cancels any pending timer.
 *   invalidate()      → bumps the generation, so any in-flight
 *                        scheduled callback no-ops when it fires.
 */
export function useAutoResetTimer() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generationRef = useRef(0);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, []);

  function schedule(callback: () => void, ms: number) {
    if (timerRef.current) clearTimeout(timerRef.current);
    const gen = generationRef.current;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (gen !== generationRef.current) return;
      callback();
    }, ms);
  }

  function clear() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function invalidate() {
    generationRef.current += 1;
    clear();
  }

  return { schedule, clear, invalidate };
}
