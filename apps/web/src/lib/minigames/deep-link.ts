/**
 * `?content=<id>[&from=featured|library]` — the route boundary's resolver.
 *
 * REPLACES `pieceForContent()`, which searched the Knight's Tour pool alone.
 * Every other lane's id was dropped here in silence: the player got a generic
 * screen, nothing threw, and nothing looked broken. Reusing `resolveChallenge`
 * means the deep link and the catalog can never disagree about what a real
 * challenge is.
 *
 * ⛔ WHAT CHANGED WITH THE PERSONAL QUEUE (2026-08-21)
 * The old param was `&featured=<rotationId>` and the bypass was earned by
 * MEMBERSHIP IN A CURATED ROTATION. There is no rotation any more, and the
 * Library must be able to open all 13 healthy challenges — so the bypass is now
 * earned by the challenge being HEALTHY (an `early-access` engine) and by the
 * player arriving from a Mini-games surface. A hand-typed `&from=featured` on a
 * retired id, a lane-1 exercise id or a coming-soon engine still buys nothing,
 * because `resolveChallenge` and the engine status decide, not the query string.
 *
 * ⚠️ `origin` is NOT overloaded onto `featured`. It decides two different
 * things that used to be one: whether the progression lock is skipped, and
 * WHERE a completion returns to. Library players must not be dropped into
 * Exercises, which is exactly what a single boolean would have done.
 *
 * Pure: no IO, no Date, no storage.
 */

import type { PieceId } from "@/lib/game/types";
import { resolveChallenge } from "@/lib/minigames/catalog";
import type { MiniGamePools } from "@/lib/minigames/pools";

/** Where the player came from. `exercise_path` is the default and the only one
 *  the URL cannot assert — it is what "no origin" means. */
export type ChallengeOrigin = "featured" | "library" | "exercise_path";

/** The origins a URL may name. `exercise_path` is deliberately absent: it is
 *  the fallback, so it can never be spoofed into existence. */
const URL_ORIGINS = new Set<ChallengeOrigin>(["featured", "library"]);

export function parseChallengeOrigin(raw: string | undefined): ChallengeOrigin {
  return raw && URL_ORIGINS.has(raw as ChallengeOrigin)
    ? (raw as ChallengeOrigin)
    : "exercise_path";
}

export type MiniGameDeepLink = {
  contentId: string;
  piece: PieceId;
  origin: ChallengeOrigin;
  /** Skips the lane's PROGRESSION lock and nothing else. */
  bypassProgressionLock: boolean;
};

export function resolveMiniGameDeepLink(args: {
  contentId: string | undefined;
  origin?: string | undefined;
  pools: MiniGamePools;
}): MiniGameDeepLink | null {
  const { contentId, pools } = args;
  if (!contentId) return null;

  const resolved = resolveChallenge(pools, contentId);
  if (!resolved) return null;

  const origin = parseChallengeOrigin(args.origin);

  return {
    contentId,
    piece: resolved.piece,
    origin,
    bypassProgressionLock:
      origin !== "exercise_path" && resolved.engine.status === "early-access",
  };
}
