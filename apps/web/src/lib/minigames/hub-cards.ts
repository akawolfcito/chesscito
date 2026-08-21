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
  resolveChallengePool,
  resolveConsumptionPolicy,
  resolveFeaturedChallenges,
} from "@/lib/minigames/queue";
import type { MiniGamesCard } from "@/components/hub/minigames-section";

export type MiniGamesHubView = {
  cards: MiniGamesCard[];
  comingSoon: MiniGameEngineId[];
  /** Every healthy challenge completed at least once. */
  exhausted: boolean;
  completedCount: number;
  poolSize: number;
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
}): MiniGamesHubView {
  const { pools, bestsByPiece } = args;

  const comingSoon = MINIGAME_ENGINES.filter(
    (engine) => engine.status === "coming-soon",
  ).map((engine) => engine.id);

  const empty = {
    cards: [] as MiniGamesCard[],
    comingSoon,
    exhausted: false,
    completedCount: 0,
    poolSize: 0,
  };

  // The seam. Free in Early Access; a future policy denies HERE and nowhere else.
  if (!resolveMiniGamesAccess({}).allowed) return empty;

  const policy = resolveConsumptionPolicy({});
  const pool = resolveChallengePool(pools);
  const completed = completedChallengeIds(bestsByPiece);
  const queue = resolveFeaturedChallenges({
    pool,
    completedChallengeIds: completed,
    limit: policy.featuredLimit,
  });

  return {
    cards: queue.items.map((entry) => ({
      challengeId: entry.challengeId,
      engineId: entry.engineId,
      piece: entry.piece,
      title: entry.challenge.title ?? entry.challengeId,
      state: deriveFeaturedCardState({ featured: entry, pools, bestsByPiece }),
      /* NEW means "you have never completed this". Under the rotation model it
         meant "it was not in the PREVIOUS rotation", which said nothing about
         this player — a returning player saw NEW on a level they had already
         cleared. Still no storage: it is the completion set, inverted. */
      isNew: entry.unseen,
    })),
    comingSoon,
    exhausted: queue.exhausted,
    completedCount: queue.completedCount,
    poolSize: queue.poolSize,
  };
}

/** Where a mini-game card navigates. `from` decides the progression bypass AND
 *  the completion return, which used to be one overloaded flag. */
export function challengeHref(
  challengeId: string,
  origin: "featured" | "library",
): string {
  return `/exercises?content=${encodeURIComponent(challengeId)}&from=${origin}`;
}
