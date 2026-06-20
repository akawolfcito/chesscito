/**
 * Focus Passport (Chesscito Lite P1) — pure view derivation.
 *
 * Streak-based, local-only. Reuses `DailyProgress` from `progress.ts`
 * WITHOUT adding any new persisted field (no `completedDates[]`). The
 * 7 slots represent the CURRENT streak count, NOT specific calendar
 * days — so we never claim a particular day was completed when we only
 * know the running streak. No DOM, no localStorage here: this module is
 * pure and testable; callers hydrate `DailyProgress` and pass it in.
 *
 * Spec: docs/specs/2026-06-20-focus-passport-p1.md
 * Plan: docs/specs/2026-06-20-focus-passport-p1-implementation-plan.md
 */

import type { DailyProgress } from "@/lib/daily/progress";

/** Fixed number of slots shown in the passport row. */
export const PASSPORT_TOTAL_SLOTS = 7 as const;

/** Copy/state buckets: 0 → empty, 1 → day1, 2-6 → building, 7+ → week. */
export type PassportTier = "empty" | "day1" | "building" | "week";

export type PassportView = {
  /** Filled slots = streak clamped to [0, 7]. */
  filledSlots: number;
  /** Always 7 (P1 has no calendar history). */
  totalSlots: typeof PASSPORT_TOTAL_SLOTS;
  /** True only when today's focus is already solved. */
  todayDone: boolean;
  /** Drives which copy variant the card renders. */
  tier: PassportTier;
  /** Normalized streak (floored, non-negative). */
  streak: number;
};

/** Clamps a raw streak to the [0, 7] slot range (floor + cap). */
export function passportFilledSlots(streak: number): number {
  const normalized = Math.max(0, Math.floor(streak));
  return Math.min(normalized, PASSPORT_TOTAL_SLOTS);
}

/** Maps a raw streak to its copy tier. */
export function passportTier(streak: number): PassportTier {
  const normalized = Math.max(0, Math.floor(streak));
  if (normalized <= 0) return "empty";
  if (normalized === 1) return "day1";
  if (normalized >= PASSPORT_TOTAL_SLOTS) return "week";
  return "building";
}

/** Derives the full presentational view from persisted progress. Pure. */
export function derivePassportView(progress: DailyProgress, today: string): PassportView {
  const streak = Math.max(0, Math.floor(progress.streak));
  return {
    filledSlots: passportFilledSlots(streak),
    totalSlots: PASSPORT_TOTAL_SLOTS,
    todayDone: progress.lastCompletedDate === today,
    tier: passportTier(streak),
    streak,
  };
}
