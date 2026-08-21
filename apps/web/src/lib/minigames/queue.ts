/**
 * Per-user mini-games queue — what is Featured, and what the Library holds.
 *
 * WHAT THIS REPLACES
 * ------------------
 * `MINIGAME_ROTATIONS` / `ACTIVE_ROTATION_ID` shipped ONE global set of three
 * to everybody, advanced by a human editing a constant. That model cannot serve
 * a player: someone who cleared all three saw the same three until the next
 * release, and someone who had never opened a mini-game saw whatever the
 * rotation had moved on to. Progression here is driven by CONSUMPTION, not by
 * the calendar and not by the release cadence.
 *
 * ⛔ NO Date, NO Date.now, NO rotation constant, NO storage, NO IO, NO React.
 * The completion set is passed in. A test asserts the absence of the first two
 * by reading this file, because "deterministic" is a property that a single
 * `Date.now()` silently destroys.
 *
 * ⚠️ THE QUEUE OWNS NO STATE. It is a pure projection of
 * (pool, completedChallengeIds). That is what makes replay non-consuming for
 * free: a replay re-writes a completion id that is already in the set, and a
 * set has no notion of "again".
 */

import type { Exercise, PieceId } from "@/lib/game/types";
import {
  earlyAccessEngines,
  engineChallenges,
  type MiniGameEngineId,
} from "@/lib/minigames/catalog";
import type { MiniGamePools } from "@/lib/minigames/pools";

/** A challenge as any Mini-games surface renders it. Formerly exported by
 *  `rotation.ts`, which this module replaced outright. */
export type FeaturedChallenge = {
  challengeId: string;
  engineId: MiniGameEngineId;
  piece: PieceId;
  challenge: Exercise;
};

/** Featured slots. Three fits the 390px rail beside the Exercises tile, which
 *  is the hierarchy the founder approved — this is a layout constant, not a
 *  policy one, and a future allowance must not be smuggled in by changing it. */
export const FEATURED_LIMIT = 3;

export type QueuedChallenge = FeaturedChallenge & {
  /** The player has never completed this one. Drives the NEW flag with no
   *  storage of its own — under the rotation model this was "was it in the
   *  previous rotation", which said nothing about THIS player. */
  unseen: boolean;
};

export type FeaturedQueue = {
  items: QueuedChallenge[];
  /** Every healthy challenge has been completed at least once. */
  exhausted: boolean;
  /** Distinct completed challenges that are still in the healthy pool. */
  completedCount: number;
  poolSize: number;
};

/**
 * Every healthy challenge, in canonical order: engines in `MINIGAME_ENGINES`
 * order, challenges in authored order within an engine.
 *
 * Reads the PROJECTED lane through `engineChallenges`, so retired ids
 * (`bishop-lab-3`, `knight-lab-1`, …) cannot appear here — the same rule that
 * protects the deep link, applied by reusing the same function rather than by
 * keeping a second list in sync.
 */
export function resolveChallengePool(pools: MiniGamePools): FeaturedChallenge[] {
  const out: FeaturedChallenge[] = [];
  for (const engine of earlyAccessEngines()) {
    for (const challenge of engineChallenges(pools, engine.id)) {
      out.push({
        challengeId: challenge.id,
        engineId: engine.id,
        piece: engine.piece,
        challenge,
      });
    }
  }
  return out;
}

/* ── The policy seam (PART 13: DESIGN ONLY) ──────────────────────────────
 * Featured resolution takes its limit FROM the policy rather than reading the
 * constant, so a future allowance ("your free 6 are used, unlock more") plugs
 * in by widening this return type and its caller — never by rewriting the
 * resolver. ⛔ Nothing here encodes a per-day count, a Peones price or a reset
 * window, and a test asserts the shape has exactly these three keys so one
 * cannot be added without a deliberate, reviewable change. */

export const EARLY_ACCESS_CONSUMPTION = "early_access_free" as const;

/** What a future policy would read about the player. Empty today, on purpose —
 *  the compile-time proof that no balance or entitlement reaches this decision. */
export type ConsumptionPlayer = Record<string, never>;

export type ConsumptionPolicy = {
  policy: typeof EARLY_ACCESS_CONSUMPTION;
  featuredLimit: number;
  unrestricted: boolean;
};

export function resolveConsumptionPolicy(
  _player: ConsumptionPlayer = {},
): ConsumptionPolicy {
  return {
    policy: EARLY_ACCESS_CONSUMPTION,
    featuredLimit: FEATURED_LIMIT,
    unrestricted: true,
  };
}

/**
 * The player's visible Featured set.
 *
 * ALGORITHM — two greedy passes over the pool in canonical order:
 *   1. take unseen challenges, at most one per engine;
 *   2. if the limit is still not met, take the remaining unseen in order.
 *
 * Pass 2 is what keeps variety a PREFERENCE rather than a cap: when only one
 * engine has content left, the set still fills instead of starving to one card.
 *
 * Because both passes walk a fixed order and the only input is a SET, the
 * output cannot depend on the order completions arrived in, on the time of day,
 * or on how many times a level was replayed.
 *
 * EXHAUSTED: when nothing is unseen, this returns the first `limit` COMPLETED
 * challenges as replays, flagged `unseen: false`. Returning an empty array
 * would make the Learn Home group vanish entirely (the section renders null on
 * zero cards) — "you cleared everything" would look exactly like "mini-games
 * were removed". The surface pairs this with its all-clear line.
 */
/**
 * The picker, shared by the plain queue and by the daily window resolver.
 *
 * Two greedy passes over the pool in canonical order: one challenge per engine
 * first, then fill. Pass 2 is what keeps variety a PREFERENCE rather than a cap
 * — when only one engine has content left the set still fills instead of
 * starving to a single card.
 *
 * `seen` is whatever the caller wants excluded: completed ids for the plain
 * queue, completed PLUS already-assigned ids when a daily window is topping up
 * its freed slots.
 */
export function pickUnseen(
  pool: readonly FeaturedChallenge[],
  seen: ReadonlySet<string>,
  limit: number,
): FeaturedChallenge[] {
  const unseen = pool.filter((entry) => !seen.has(entry.challengeId));
  const picked: FeaturedChallenge[] = [];
  const usedEngines = new Set<MiniGameEngineId>();

  for (const entry of unseen) {
    if (picked.length >= limit) break;
    if (usedEngines.has(entry.engineId)) continue;
    usedEngines.add(entry.engineId);
    picked.push(entry);
  }

  for (const entry of unseen) {
    if (picked.length >= limit) break;
    if (picked.includes(entry)) continue;
    picked.push(entry);
  }

  return picked;
}

export function resolveFeaturedChallenges(args: {
  pool: readonly FeaturedChallenge[];
  completedChallengeIds: ReadonlySet<string>;
  limit?: number;
}): FeaturedQueue {
  const { pool, completedChallengeIds } = args;
  const limit = args.limit ?? FEATURED_LIMIT;

  const isDone = (entry: FeaturedChallenge) =>
    completedChallengeIds.has(entry.challengeId);

  const unseen = pool.filter((entry) => !isDone(entry));
  const completedCount = pool.length - unseen.length;

  if (unseen.length === 0) {
    return {
      items: pool.slice(0, limit).map((entry) => ({ ...entry, unseen: false })),
      exhausted: pool.length > 0,
      completedCount,
      poolSize: pool.length,
    };
  }

  const picked = pickUnseen(pool, completedChallengeIds, limit);

  return {
    items: picked.map((entry) => ({ ...entry, unseen: true })),
    exhausted: false,
    completedCount,
    poolSize: pool.length,
  };
}

/* ── Library ─────────────────────────────────────────────────────────────── */

export type LibraryChallenge = FeaturedChallenge & { completed: boolean };

export type MiniGamesLibrary = {
  /** Assigned this window and not yet cleared. Playable. */
  today: LibraryChallenge[];
  /** Cleared at some point. Playable — replay is the point of the Library. */
  completed: LibraryChallenge[];
  /** Healthy challenges that are neither assigned nor cleared. NOT playable,
   *  and NOT enumerated: the surface shows one low-noise line, never a wall of
   *  locked titles. */
  upcoming: number;
  total: number;
};

/**
 * The Library, grouped by AVAILABILITY rather than by game.
 *
 * ⛔ THE GROUPING IS THE GATE. Before the daily allowance this listed all 13 as
 * playable, which would have let a player walk straight past the window and
 * burn the catalogue from the Library instead of the Home. What a player asks
 * here is "what can I play", so that is what the sections answer.
 *
 * ⛔ `upcoming` is a COUNT and the surface does not even print it. Rendering
 * ten locked rows would turn the Library into a wall of locks, and naming the
 * number would re-introduce the catalogue size the Home just stopped showing.
 * It exists so the surface can decide whether to show its one line at all.
 *
 * Coming-soon engines are absent by construction (`earlyAccessEngines`): a row
 * that can never be played is a dead end dressed as content.
 */
export function resolveLibrary(
  pools: MiniGamePools,
  completedChallengeIds: ReadonlySet<string> = new Set(),
  assignedChallengeIds: ReadonlySet<string> = new Set(),
): MiniGamesLibrary {
  const pool = resolveChallengePool(pools);

  const today: LibraryChallenge[] = [];
  const completed: LibraryChallenge[] = [];
  let upcoming = 0;

  for (const entry of pool) {
    const isDone = completedChallengeIds.has(entry.challengeId);
    if (isDone) {
      completed.push({ ...entry, completed: true });
    } else if (assignedChallengeIds.has(entry.challengeId)) {
      today.push({ ...entry, completed: false });
    } else {
      upcoming += 1;
    }
  }

  return { today, completed, upcoming, total: pool.length };
}
