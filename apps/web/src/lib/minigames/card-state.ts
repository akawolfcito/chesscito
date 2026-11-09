/**
 * Featured mini-game card state.
 *
 * ⛔ THE UNION IS THE PRODUCT DECISION. There is no `PROGRESSION_LOCKED` and no
 * `EARLY_UNLOCK_AVAILABLE` member, so a card CANNOT render a price, a lock or a
 * purchase CTA during Early Access — not by policy, by types. Adding either
 * back is a deliberate, reviewable widening rather than a prop somebody forgot
 * to pass.
 *
 * Completion is read from the existing per-piece best map
 * (`chesscito:labyrinth-best:{piece}`), passed in rather than read, so this
 * stays pure and so nothing about which challenges are on screen can ever
 * revoke a completion: the map is keyed by challenge id and this module never
 * writes it.
 */

import { engineChallenges } from "@/lib/minigames/catalog";
import type { MiniGamePools } from "@/lib/minigames/pools";
import type { FeaturedChallenge } from "@/lib/minigames/queue";

export type FeaturedCardState =
  | "FEATURED_AVAILABLE"
  | "FEATURED_IN_PROGRESS"
  | "FEATURED_COMPLETED";

/**
 * `FEATURED_IN_PROGRESS` is only reachable through the ENGINE, never the
 * challenge: at per-challenge granularity a level is done or it is not. What
 * "Continue" honestly means here is "you have played this game before, just not
 * this level" — which is exactly the case a mid-lane featured level creates.
 *
 * ⚠️ Siblings are read from the PROJECTED lane, so a retired id sitting in the
 * player's stored bests (e.g. `rook-lab-1` from before the signature games)
 * never counts as progress in a game it does not belong to.
 */
export function deriveFeaturedCardState(args: {
  featured: FeaturedChallenge;
  pools: MiniGamePools;
  bestsByPiece: Record<string, Record<string, number> | undefined>;
}): FeaturedCardState {
  const { featured, pools, bestsByPiece } = args;
  const bests = bestsByPiece[featured.piece] ?? {};

  if (bests[featured.challengeId] != null) return "FEATURED_COMPLETED";

  const siblings = engineChallenges(pools, featured.engineId);
  const touchedSibling = siblings.some(
    (entry) => entry.id !== featured.challengeId && bests[entry.id] != null,
  );

  return touchedSibling ? "FEATURED_IN_PROGRESS" : "FEATURED_AVAILABLE";
}
