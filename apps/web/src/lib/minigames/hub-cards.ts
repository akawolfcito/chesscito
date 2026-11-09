/**
 * Learn Home mini-games section → the cards it renders.
 *
 * One pure derivation so the container stays a wiring layer and the whole
 * surface is testable without a wallet, a provider or a DOM.
 *
 * ⛔ WHAT CHANGED (2026-08-21): it used to read `getActiveRotation()` — one
 * global set of three, the same for every account, advanced by editing a
 * constant. It now reads the player's own completions and asks
 * `resolveFeaturedChallenges`. Nothing about a player's progress moved: the
 * completion evidence is the SAME per-piece best map it always read.
 *
 * ⛔ It reads NO balance, NO entitlement and NO wallet. Access is decided by
 * `resolveMiniGamesAccess`, free for everyone in Early Access; if it ever
 * denies, this returns no cards rather than rendering an offer the router
 * would refuse.
 */

import { MINIGAME_ENGINES, type MiniGameEngineId } from "@/lib/minigames/catalog";
import { deriveFeaturedCardState } from "@/lib/minigames/card-state";
import { resolveMiniGamesAccess } from "@/lib/minigames/access";
import type { MiniGamePools } from "@/lib/minigames/pools";
import {
  DAILY_NEW_SLOTS,
  resolveWindowAssignment,
  type WindowAssignment,
} from "@/lib/minigames/daily-window";
import { resolveChallengePool, resolveConsumptionPolicy } from "@/lib/minigames/queue";
import type { MiniGamesCard } from "@/components/hub/minigames-section";

export type MiniGamesHubView = {
  cards: MiniGamesCard[];
  comingSoon: MiniGameEngineId[];
  /** Assigned challenges the player has already completed. The numerator of
   *  `n/3 today` — and the ONLY count the Learn Home shows. */
  completedToday: number;
  /** Assigned slots this window. Normally `DAILY_NEW_SLOTS`; smaller only when
   *  the catalogue is running out. */
  slotCount: number;
  /** Every healthy challenge completed at least once. Nothing will refill. */
  poolExhausted: boolean;
  /** The assignment to persist, and whether it actually changed. */
  assignment: WindowAssignment;
  assignmentChanged: boolean;
};

/**
 * The set of challenge ids this player has completed, read from the existing
 * per-piece best maps.
 *
 * ⚠️ DEVICE-LOCAL, and deliberately so in V0. `chesscito:labyrinth-best:{piece}`
 * is written only on a successful completion (`recordLabyrinthBest`, guarded by
 * `run.isComplete`), which makes it an exact match for the consumption unit:
 * present = completed at least once, and a replay rewrites a key that is
 * already there. Server evidence (`score_attempts`) would be a GRANT-ONLY union
 * on top of this — `completed = local OR server`, never a revocation — and it
 * belongs in this one function when it lands. See the audit for why it is not
 * wired yet.
 */
export function completedChallengeIds(
  bestsByPiece: Record<string, Record<string, number> | undefined>,
): Set<string> {
  const out = new Set<string>();
  for (const bests of Object.values(bestsByPiece)) {
    for (const [challengeId, best] of Object.entries(bests ?? {})) {
      if (best != null) out.add(challengeId);
    }
  }
  return out;
}

export function deriveMiniGamesHubView(args: {
  pools: MiniGamePools;
  /** Existing per-piece best maps (`chesscito:labyrinth-best:{piece}`). */
  bestsByPiece: Record<string, Record<string, number> | undefined>;
  /** Last persisted window assignment, or null on a fresh device. */
  stored: WindowAssignment | null;
  /** The UTC day this render belongs to, injected so nothing here reads a clock. */
  windowId: string;
}): MiniGamesHubView {
  const { pools, bestsByPiece, stored, windowId } = args;

  const comingSoon = MINIGAME_ENGINES.filter(
    (engine) => engine.status === "coming-soon",
  ).map((engine) => engine.id);

  const empty: MiniGamesHubView = {
    cards: [],
    comingSoon,
    completedToday: 0,
    slotCount: 0,
    poolExhausted: false,
    assignment: { windowId, assigned: [] },
    assignmentChanged: false,
  };

  // The seam. Free in Early Access; a future policy denies HERE and nowhere else.
  if (!resolveMiniGamesAccess({}).allowed) return empty;

  // The policy owns the ALLOWANCE. It reports `DAILY_NEW_SLOTS` today; a future
  // paid batch widens it here and nowhere else.
  resolveConsumptionPolicy({});

  const pool = resolveChallengePool(pools);
  const completed = completedChallengeIds(bestsByPiece);
  const window = resolveWindowAssignment({
    stored,
    windowId,
    pool,
    completedChallengeIds: completed,
  });

  const byId = new Map(pool.map((entry) => [entry.challengeId, entry]));
  const assigned = window.assignment.assigned
    .map((id) => byId.get(id))
    .filter((entry): entry is NonNullable<typeof entry> => entry != null);

  return {
    cards: assigned.map((entry) => ({
      challengeId: entry.challengeId,
      engineId: entry.engineId,
      piece: entry.piece,
      title: entry.challenge.title ?? entry.challengeId,
      state: deriveFeaturedCardState({ featured: entry, pools, bestsByPiece }),
      /* NEW means "you have never completed this". Under the old global
         rotation it meant "it was not in the PREVIOUS rotation", which said
         nothing about this player. Still no storage: the completion set,
         inverted. */
      isNew: !completed.has(entry.challengeId),
    })),
    comingSoon,
    completedToday: assigned.filter((entry) => completed.has(entry.challengeId)).length,
    slotCount: assigned.length,
    poolExhausted: window.poolExhausted,
    assignment: window.assignment,
    assignmentChanged: window.changed,
  };
}

/** Re-exported so a surface can talk about the cap without importing two modules. */
export { DAILY_NEW_SLOTS };

/** Where a mini-game card navigates. `from` decides the progression bypass AND
 *  the completion return, which used to be one overloaded flag. */
export function challengeHref(
  challengeId: string,
  origin: "featured" | "library",
): string {
  return `/exercises?content=${encodeURIComponent(challengeId)}&from=${origin}`;
}
