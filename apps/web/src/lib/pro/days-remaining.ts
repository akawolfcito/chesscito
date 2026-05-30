const MS_PER_DAY = 86_400_000;

/** Days remaining until a PRO pass expires, rounded up so any partial
 *  day reads as a full day. Returns `null` when the timestamp is
 *  missing or already past — callers pattern-match on null to hide
 *  the sub-line entirely instead of rendering "0 days".
 *
 *  Clamped to >=1: upstream `active` checks already filter expired
 *  passes, so an active subscription showing "0 days left" would be
 *  self-contradictory.
 *
 *  Pure function — `now` is passed explicitly so tests and SSR don't
 *  drift against an ambient `Date.now()`. */
export function daysRemaining(
  expiresAtMs: number | null | undefined,
  nowMs: number,
): number | null {
  if (expiresAtMs == null || !Number.isFinite(expiresAtMs)) return null;
  if (expiresAtMs <= nowMs) return null;
  return Math.max(1, Math.ceil((expiresAtMs - nowMs) / MS_PER_DAY));
}
