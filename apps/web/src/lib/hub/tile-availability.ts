/**
 * Hub right-rail tile availability — PURE, computed once at mount.
 *
 * Performance contract (founder micro-block 2026-06-11): the hub
 * NEVER runs per-second timers for these states. The caller computes
 * availability when /hub mounts (or re-mounts on navigation) and
 * renders a static, approximate label: "Ready" / "Next Xh" /
 * "Tomorrow". No live countdown, no setInterval, no re-render loop.
 */

export type TileAvailability =
  | { state: "ready" }
  /** Cooldown short enough to show approximate hours ("Next 6h"). */
  | { state: "next"; hours: number }
  /** Long cooldown — a fuzzy "Tomorrow" reads calmer than "Next 19h". */
  | { state: "tomorrow" };

/** Above this many remaining hours the chip says "Tomorrow" instead
 *  of an hour count — large hour numbers read as a wall, not a nudge. */
const TOMORROW_THRESHOLD_HOURS = 12;

/** Hours until the next UTC day boundary (daily reset). */
export function hoursUntilNextUtcDay(now: Date = new Date()): number {
  const next = new Date(now);
  next.setUTCDate(next.getUTCDate() + 1);
  next.setUTCHours(0, 0, 0, 0);
  return Math.max(0, (next.getTime() - now.getTime()) / (1000 * 60 * 60));
}

/** Availability of a once-per-UTC-day surface (Daily Tactic). */
export function dailyAvailability(
  completedToday: boolean,
  now: Date = new Date(),
): TileAvailability {
  if (!completedToday) return { state: "ready" };
  const hours = Math.max(1, Math.ceil(hoursUntilNextUtcDay(now)));
  if (hours > TOMORROW_THRESHOLD_HOURS) return { state: "tomorrow" };
  return { state: "next", hours };
}

/** Compact chip label for a cooldown state. Ready states render a
 *  dot, not text (see HubTileStatusChip). */
export function cooldownLabel(a: TileAvailability): string | null {
  if (a.state === "next") return `Next ${a.hours}h`;
  if (a.state === "tomorrow") return "Tomorrow";
  return null;
}
