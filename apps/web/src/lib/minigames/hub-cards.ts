/**
 * Learn Home mini-games section → the cards it renders.
 *
 * One pure derivation so the container stays a wiring layer and the whole
 * surface is testable without a wallet, a provider or a DOM. It reads the
 * active rotation, the projected catalog and the player's existing per-piece
 * bests, and returns exactly what `<MiniGamesSection>` needs.
 *
 * ⛔ It reads NO balance, NO entitlement and NO wallet. Access is decided by
 * `resolveMiniGamesAccess`, which is free for everyone in Early Access; if it
 * ever denies, this returns no cards rather than rendering an offer the router
 * would refuse.
 */

import {
  earlyAccessEngines,
  MINIGAME_ENGINES,
  type MiniGameEngineId,
} from "@/lib/minigames/catalog";
import { deriveFeaturedCardState } from "@/lib/minigames/card-state";
import { resolveMiniGamesAccess } from "@/lib/minigames/access";
import type { MiniGamePools } from "@/lib/minigames/pools";
import {
  carriedOverIds,
  isRotationComplete,
  resolveRotation,
  type MiniGameRotation,
} from "@/lib/minigames/rotation";
import type { MiniGamesCard } from "@/components/hub/minigames-section";

export type MiniGamesHubView = {
  rotationId: string;
  cards: MiniGamesCard[];
  comingSoon: MiniGameEngineId[];
  rotationComplete: boolean;
};

export function deriveMiniGamesHubView(args: {
  rotation: MiniGameRotation;
  pools: MiniGamePools;
  /** Existing per-piece best maps (`chesscito:labyrinth-best:{piece}`). */
  bestsByPiece: Record<string, Record<string, number> | undefined>;
}): MiniGamesHubView {
  const { rotation, pools, bestsByPiece } = args;

  const comingSoon = MINIGAME_ENGINES.filter(
    (engine) => engine.status === "coming-soon",
  ).map((engine) => engine.id);

  // The seam. Free in Early Access; a future policy denies HERE and nowhere else.
  if (!resolveMiniGamesAccess(rotation, {}).allowed) {
    return { rotationId: rotation.id, cards: [], comingSoon, rotationComplete: false };
  }

  const featured = resolveRotation(rotation, pools);
  const carried = carriedOverIds(rotation.id);

  return {
    rotationId: rotation.id,
    cards: featured.map((entry) => ({
      challengeId: entry.challengeId,
      engineId: entry.engineId,
      piece: entry.piece,
      state: deriveFeaturedCardState({ featured: entry, pools, bestsByPiece }),
      isNew: !carried.has(entry.challengeId),
    })),
    comingSoon,
    rotationComplete: isRotationComplete(featured, bestsByPiece),
  };
}

/** The engines a rotation may draw from. Exposed so a `/dev` probe or a future
 *  surface can list the launch set without re-deriving the status rule. */
export function launchEngineIds(): MiniGameEngineId[] {
  return earlyAccessEngines().map((engine) => engine.id);
}

/**
 * Where a featured card navigates.
 *
 * `featured=<rotationId>` is what lets the screen skip the lane's progression
 * lock — and it is honoured ONLY when that rotation genuinely features the id
 * (`resolveMiniGameDeepLink`), so the bypass is bounded by curation rather than
 * by trust in a query string.
 */
export function featuredChallengeHref(
  challengeId: string,
  rotationId: string,
): string {
  return `/exercises?content=${encodeURIComponent(
    challengeId,
  )}&featured=${encodeURIComponent(rotationId)}`;
}
