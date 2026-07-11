import { todayUtc } from "@/lib/daily/progress";
import { dailyStarsStorageKey } from "@/lib/lite-progress-storage";

/** Stars earned today. The ONLY daily counter in the progression system.
 *  Fed by exercises AND labyrinths, always as net improvement — replaying
 *  a solved exercise must never inflate a session. */
export type DailyStarLedger = {
  date: string;
  stars: number;
};

/** The improvement a result represents over the player's previous best.
 *  A replay that does not beat the best contributes nothing. */
export function netStars(previousBest: number, newStars: number): number {
  return Math.max(0, newStars - previousBest);
}

export function parseDailyStars(
  raw: string | null,
  today: string = todayUtc(),
): DailyStarLedger {
  const fresh: DailyStarLedger = { date: today, stars: 0 };
  if (!raw) return fresh;
  try {
    const parsed = JSON.parse(raw) as Partial<DailyStarLedger>;
    if (parsed?.date !== today) return fresh;
    return {
      date: today,
      stars: typeof parsed.stars === "number" ? Math.max(0, parsed.stars) : 0,
    };
  } catch {
    return fresh;
  }
}

export function computeAddNetStars(
  state: DailyStarLedger,
  gain: number,
): DailyStarLedger {
  if (gain <= 0) return state;
  return { ...state, stars: state.stars + gain };
}

// ─── localStorage I/O ────────────────────────────────────────────────────

export function getDailyStarLedger(): DailyStarLedger {
  if (typeof window === "undefined") return parseDailyStars(null);
  try {
    return parseDailyStars(localStorage.getItem(dailyStarsStorageKey()));
  } catch {
    return parseDailyStars(null);
  }
}

/** Convenience read for callers that only need the number. */
export function getDailyStars(): number {
  return getDailyStarLedger().stars;
}

/** Adds the net improvement a result represents. Call this once per solved
 *  activity, exercise or labyrinth, with the previous best in hand. */
export function addNetStars(previousBest: number, newStars: number): DailyStarLedger {
  const current = getDailyStarLedger();
  const next = computeAddNetStars(current, netStars(previousBest, newStars));
  if (next === current) return current;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(dailyStarsStorageKey(), JSON.stringify(next));
    } catch {
      // Quota or privacy mode — the caller still gets the correct state back.
    }
  }
  return next;
}
