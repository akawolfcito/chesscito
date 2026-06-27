/** Current day (1-based) of an active season-pass challenge, derived from its
 *  expiry. `day = durationDays - daysRemaining + 1`, clamped to
 *  `[1, durationDays]`. A just-purchased pass (full window left) is Day 1; the
 *  last day is `durationDays`. Invalid/null expiry → Day 1 (safe default), so
 *  the active card never shows a blank or out-of-range day. */
export function challengeDayFromExpiry(
  expiresAt: string | null | undefined,
  durationDays: number,
  now: number = Date.now(),
): number {
  if (!expiresAt) return 1;
  const expiryMs = Date.parse(expiresAt);
  if (Number.isNaN(expiryMs)) return 1;

  const dayMs = 24 * 60 * 60 * 1000;
  const daysRemaining = Math.ceil((expiryMs - now) / dayMs);
  const day = durationDays - daysRemaining + 1;
  return Math.min(Math.max(day, 1), durationDays);
}
