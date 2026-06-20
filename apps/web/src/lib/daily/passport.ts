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

/** Flame colorway per slot (P1.1 visual iteration):
 *  - `blue`  → a completed earlier day in the streak (frozen flame).
 *  - `color` → today completed / the active completed day (orange-gold).
 *  - `gray`  → pending / future day. */
export type PassportSlotKind = "blue" | "color" | "gray";

export type PassportSlot = {
  kind: PassportSlotKind;
  /** Subtle highlight on the single "next, still-pending today" slot. */
  glow: boolean;
};

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
  /** 7 flame descriptors derived purely from filledSlots + todayDone. */
  slots: PassportSlot[];
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

/** Derives the 7 flame slots from the filled count + whether today is done.
 *  Pure, no data mutation. When `todayDone`, the last filled slot is the
 *  current (color) flame and earlier filled slots are frozen (blue). When
 *  today is still pending, all filled slots are frozen and the next slot
 *  gets a subtle glow to signal "this is today, go solve it". */
export function passportSlots(filledSlots: number, todayDone: boolean): PassportSlot[] {
  const filled = Math.min(Math.max(0, Math.floor(filledSlots)), PASSPORT_TOTAL_SLOTS);
  const currentIndex = todayDone ? filled - 1 : -1;
  const nextPendingIndex = !todayDone ? filled : -1;
  return Array.from({ length: PASSPORT_TOTAL_SLOTS }, (_, i) => {
    if (i < filled) {
      return { kind: i === currentIndex ? "color" : "blue", glow: false };
    }
    return { kind: "gray", glow: i === nextPendingIndex && i < PASSPORT_TOTAL_SLOTS };
  });
}

/** Derives the full presentational view from persisted progress. Pure. */
export function derivePassportView(progress: DailyProgress, today: string): PassportView {
  const streak = Math.max(0, Math.floor(progress.streak));
  const filledSlots = passportFilledSlots(streak);
  const todayDone = progress.lastCompletedDate === today;
  return {
    filledSlots,
    totalSlots: PASSPORT_TOTAL_SLOTS,
    todayDone,
    tier: passportTier(streak),
    streak,
    slots: passportSlots(filledSlots, todayDone),
  };
}
