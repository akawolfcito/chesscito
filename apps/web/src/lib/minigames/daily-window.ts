/**
 * The personal daily window — WHEN a consumed Mini-games slot may refill.
 *
 * ⛔ THIS IS NOT A GLOBAL ROTATION. The challenge SEQUENCE stays personal and
 * completion-driven (`lib/minigames/queue.ts`); the only thing the clock decides
 * is when a slot the player already burned is allowed to come back. Two accounts
 * on the same day see different challenges; the same account on two days sees
 * the same unplayed ones.
 *
 * WHY A BOUNDARY AT ALL
 * The personal queue pulled the next unseen challenge the instant one was
 * completed, so a heavy player could burn all 13 in a single sitting. Founder
 * smoke, 2026-08-21.
 *
 * THE RULES, all four load-bearing:
 *   1. at most `DAILY_NEW_SLOTS` assigned challenges at a time;
 *   2. completing an assigned challenge consumes THAT slot, and it stays
 *      consumed for the rest of the window — no same-window refill;
 *   3. an UNCONSUMED slot survives the boundary untouched, so a casual player
 *      never loses content they simply did not open;
 *   4. at the next window every consumed slot — and only those — refills with
 *      the next unseen challenge.
 *
 * ⚠️ TIMEZONE: the window is the **UTC calendar day**, reusing `todayUtc` from
 * `lib/daily/progress.ts`. That is deliberate and not a shrug: the streak, the
 * focus-day ledger and the server's `p_day_utc` already draw the day there, and
 * a second definition of "day" would drift from the streak the player sees on
 * the same screen. The consequence to know: for LatAm (UTC-3…UTC-6)
 * replenishment lands in the evening, not at local midnight.
 *
 * ⛔ PURE. No storage, no React, no ambient clock — `now` is injected and
 * defaults only at the outermost call. Queue correctness must never depend on a
 * render or an interval, so the WINDOW ID is what the resolver reads; the hours
 * display is a separate, lower-precision function nothing else consumes.
 */

import { todayUtc } from "@/lib/daily/progress";
import { pickUnseen, type FeaturedChallenge } from "@/lib/minigames/queue";

/** New challenges a player may unlock per window. Product cap, not layout. */
export const DAILY_NEW_SLOTS = 3;

/**
 * ⚠️ VERSIONED KEY. A shape change bumps `:v2` rather than migrating: this is
 * FREE Early Access state whose worst-case loss is one window of assignment,
 * and a silent mis-parse of an old shape would be worse than a clean reset.
 * `parseStoredAssignment` refuses anything it does not recognise, so an old or
 * corrupt payload degrades to "fresh window", never to a broken slot.
 */
export const MINIGAME_WINDOW_STORAGE_KEY = "chesscito:minigames-window:v1";

export type WindowAssignment = {
  /** UTC day, "YYYY-MM-DD". */
  windowId: string;
  /** Challenge ids assigned for this window, in presentation order. */
  assigned: string[];
};

/** The window a moment belongs to. */
export function currentWindowId(now: Date = new Date()): string {
  return todayUtc(now);
}

/**
 * Whole hours until the next window opens, for the compact `⏱ 18h` display.
 *
 * ⛔ IT IS A DISTANCE TO A BOUNDARY, NOT A STOPWATCH. It does not start when a
 * challenge is completed and it never resets on a later completion (founder,
 * 2026-08-21) — which is why completions are not an argument. Two players who
 * completed one and three challenges see the same number.
 *
 * Rounds UP, so it never reads `0h` while the window is still open: "0h" would
 * say the content is already here.
 */
export function hoursUntilNextWindow(now: Date = new Date()): number {
  const next = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
    0,
  );
  return Math.max(1, Math.ceil((next - now.getTime()) / 3_600_000));
}

/** Reads a stored payload, refusing anything it does not fully recognise. */
export function parseStoredAssignment(raw: string | null): WindowAssignment | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const { windowId, assigned } = parsed as Record<string, unknown>;
    if (typeof windowId !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(windowId)) {
      return null;
    }
    if (!Array.isArray(assigned)) return null;
    if (!assigned.every((id): id is string => typeof id === "string")) return null;
    return { windowId, assigned };
  } catch {
    return null;
  }
}

export type ResolvedWindow = {
  assignment: WindowAssignment;
  /** True when the assignment differs from what was stored and must be written
   *  back. Lets the caller avoid a pointless localStorage write per render. */
  changed: boolean;
  /** Every healthy challenge has been completed at least once. */
  poolExhausted: boolean;
};

/**
 * This window's assignment, from the stored one.
 *
 * Same window → returned as-is (minus ids that left the catalogue). A consumed
 * slot is NOT refilled here; that is rule 2, and it is the entire pass.
 *
 * New window → carry over every assigned challenge the player has not completed,
 * then top up the freed slots from the unseen pool. `pickUnseen` is the same
 * picker Featured uses, given `completed ∪ carried` as its exclusion set, so the
 * engine-variety preference applies to a top-up exactly as it does to a fresh
 * set.
 *
 * ⚠️ "Consumed" is DERIVED, never stored. A slot is consumed iff its id is in
 * `completedChallengeIds`, which is the existing per-piece best map. Storing a
 * second copy would let the two disagree, and the disagreement would show up as
 * a slot that is finished on the board but still open in the queue.
 */
export function resolveWindowAssignment(args: {
  stored: WindowAssignment | null;
  windowId: string;
  pool: readonly FeaturedChallenge[];
  completedChallengeIds: ReadonlySet<string>;
}): ResolvedWindow {
  const { stored, windowId, pool, completedChallengeIds } = args;

  const inPool = new Set(pool.map((entry) => entry.challengeId));
  const poolExhausted =
    pool.length > 0 &&
    pool.every((entry) => completedChallengeIds.has(entry.challengeId));

  // Ids that left the catalogue cannot render a card, so they cannot hold a slot.
  const storedAssigned = (stored?.assigned ?? []).filter((id) => inPool.has(id));
  const sameWindow = stored?.windowId === windowId;

  let assigned: string[];
  if (sameWindow) {
    assigned = storedAssigned;
  } else {
    const carried = storedAssigned.filter((id) => !completedChallengeIds.has(id));
    const exclude = new Set<string>([...completedChallengeIds, ...carried]);
    const freeSlots = Math.max(0, DAILY_NEW_SLOTS - carried.length);
    assigned = [
      ...carried,
      ...pickUnseen(pool, exclude, freeSlots).map((entry) => entry.challengeId),
    ];
  }

  /* ⛔ NEVER EMPTY. `MiniGamesSection` renders `null` on zero cards, so an
     empty assignment would delete the whole Mini-games group from the Learn
     Home — and "you cleared everything" would look exactly like "mini-games
     were removed". With nothing left to assign we fall back to the first few
     pool entries as replays; the surface marks them completed and drops the
     timer, because nothing is coming. */
  if (assigned.length === 0) {
    assigned = pool.slice(0, DAILY_NEW_SLOTS).map((entry) => entry.challengeId);
  }

  const changed =
    !stored ||
    stored.windowId !== windowId ||
    stored.assigned.length !== assigned.length ||
    stored.assigned.some((id, index) => id !== assigned[index]);

  return { assignment: { windowId, assigned }, changed, poolExhausted };
}
