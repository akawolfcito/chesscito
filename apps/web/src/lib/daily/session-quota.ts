/**
 * Daily session quota — tracks extra content consumed today.
 *
 * B2.3a: local-only (localStorage). No payment rail.
 * B2.3b will extend this with server-backed paid unlock verification.
 *
 * Key design decisions:
 *  - consumedContentIds[] provides idempotence (same id twice = 1 slot)
 *  - contentId format: "exercise:{piece}:{id}" or "labyrinth:{piece}:{id}"
 *  - Daily Focus (?slot=daily) and Challenge Link (?slot=challenge) NEVER pass here
 *  - paidUnlocked is always 0 in B2.3a; B2.3b increments it on verified tx
 *  - State auto-resets when the stored date !== todayUtc()
 */

import { todayUtc } from "@/lib/daily/progress";
import { dailySessionStorageKey } from "@/lib/lite-progress-storage";
import { dispatchDailySessionChanged } from "@/lib/daily/session-events";

// ─── Constants ───────────────────────────────────────────────────────────────

export const FREE_EXTRA_QUOTA = 5;
export const PACK_EXTRA_SLOTS = 5;
export const MAX_PAID_PACKS = 2;
export const HARD_MAX_EXTRAS = FREE_EXTRA_QUOTA + PACK_EXTRA_SLOTS * MAX_PAID_PACKS; // 15

// ─── Types ───────────────────────────────────────────────────────────────────

export type DailySessionState = {
  date: string;
  consumedContentIds: string[];
  paidUnlocked: number;
};

/** Canonical content kind for ID building. */
export type ContentKind = "exercise" | "labyrinth";

// ─── ID builder ──────────────────────────────────────────────────────────────

/** Stable, collision-free ID for any consumable content item. */
export function buildContentId(kind: ContentKind, piece: string, localId: string): string {
  return `${kind}:${piece}:${localId}`;
}

// ─── Parse ───────────────────────────────────────────────────────────────────

/** Parses a raw localStorage string into a valid DailySessionState for today.
 *  Returns a fresh zeroed state when the stored date ≠ today or the value is corrupt. */
export function parseDailySession(raw: string | null, today: string = todayUtc()): DailySessionState {
  const fresh: DailySessionState = { date: today, consumedContentIds: [], paidUnlocked: 0 };
  if (!raw) return fresh;
  try {
    const parsed = JSON.parse(raw) as Partial<DailySessionState>;
    if (parsed?.date !== today) return fresh;
    return {
      date: today,
      consumedContentIds: Array.isArray(parsed.consumedContentIds) ? parsed.consumedContentIds : [],
      paidUnlocked: typeof parsed.paidUnlocked === "number" ? Math.max(0, parsed.paidUnlocked) : 0,
    };
  } catch {
    return fresh;
  }
}

// ─── Read helpers (pure) ─────────────────────────────────────────────────────

export function getUsedCount(state: DailySessionState): number {
  return state.consumedContentIds.length;
}

export function getPaidSlots(state: DailySessionState): number {
  return Math.min(state.paidUnlocked, MAX_PAID_PACKS) * PACK_EXTRA_SLOTS;
}

export function getTotalSlots(state: DailySessionState): number {
  return Math.min(FREE_EXTRA_QUOTA + getPaidSlots(state), HARD_MAX_EXTRAS);
}

export function getRemainingSlots(state: DailySessionState): number {
  return Math.max(0, getTotalSlots(state) - getUsedCount(state));
}

/** True when free quota is exhausted and no paid packs are available.
 *  This is the "soft limit" — the lock that points to the paid unlock CTA. */
export function isAtFreeLimit(state: DailySessionState): boolean {
  return getUsedCount(state) >= FREE_EXTRA_QUOTA && state.paidUnlocked === 0;
}

/** True when absolute daily maximum has been reached.
 *  No further unlock (paid or free) is possible today. */
export function isAtHardMax(state: DailySessionState): boolean {
  return getUsedCount(state) >= HARD_MAX_EXTRAS;
}

// ─── Pure state transitions ──────────────────────────────────────────────────

/** Returns the next state after recording a content item as consumed.
 *  No-op (returns same reference) when:
 *    - contentId already in consumedContentIds (idempotent)
 *    - isAtHardMax (hard cap never exceeded)
 */
export function computeRecordExtra(state: DailySessionState, contentId: string): DailySessionState {
  if (isAtHardMax(state)) return state;
  if (state.consumedContentIds.includes(contentId)) return state;
  return {
    ...state,
    consumedContentIds: [...state.consumedContentIds, contentId],
  };
}

/** Returns the next state after applying a dev mock unlock (+1 paid pack).
 *  Caps at MAX_PAID_PACKS. */
export function computeApplyDevUnlock(state: DailySessionState): DailySessionState {
  if (state.paidUnlocked >= MAX_PAID_PACKS) return state;
  return { ...state, paidUnlocked: state.paidUnlocked + 1 };
}

// ─── localStorage I/O ────────────────────────────────────────────────────────

/** Reads the daily session for today from localStorage. SSR-safe (returns fresh on server). */
export function getDailySession(): DailySessionState {
  if (typeof window === "undefined") return parseDailySession(null);
  try {
    return parseDailySession(localStorage.getItem(dailySessionStorageKey()));
  } catch {
    return parseDailySession(null);
  }
}

function persist(state: DailySessionState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(dailySessionStorageKey(), JSON.stringify(state));
  } catch {
    // Quota or privacy mode — state is still returned correctly for this session
  }
  dispatchDailySessionChanged();
}

/** Records a content item as consumed today. Persists and dispatches event.
 *  Returns the updated state (or the same reference if no-op). */
export function recordExtraConsumed(contentId: string): DailySessionState {
  const current = getDailySession();
  const next = computeRecordExtra(current, contentId);
  if (next !== current) persist(next);
  return next;
}

/** Dev-only: simulates a paid pack unlock without a real MiniPay transaction.
 *  Only available in NODE_ENV=development. No-op in production. */
export function applyDevUnlock(): DailySessionState {
  if (process.env.NODE_ENV !== "development") return getDailySession();
  const current = getDailySession();
  const next = computeApplyDevUnlock(current);
  if (next !== current) persist(next);
  return next;
}
