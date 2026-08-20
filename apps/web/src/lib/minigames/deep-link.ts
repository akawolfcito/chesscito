/**
 * `?content=<id>[&featured=<rotationId>]` — the route boundary's resolver.
 *
 * REPLACES `pieceForContent()`, which searched the Knight's Tour pool alone.
 * Every other lane's id was dropped here in silence: the player got a generic
 * screen, nothing threw, and nothing looked broken. Reusing
 * `resolveChallenge` means the deep link and rotation validation can never
 * disagree about what a real challenge is.
 *
 * ⛔ `featured` IS EARNED, NEVER ASSERTED. The query string is client-supplied,
 * and the flag lets the screen skip the lane's progression gate. It is granted
 * only when the id is genuinely inside the named, shipped rotation — so the
 * bypass is bounded by curation, and a hand-typed `&featured=1` buys nothing.
 *
 * Pure: no IO, no Date, no storage.
 */

import type { PieceId } from "@/lib/game/types";
import { resolveChallenge } from "@/lib/minigames/catalog";
import type { MiniGamePools } from "@/lib/minigames/pools";
import { getRotation } from "@/lib/minigames/rotation";

export type MiniGameDeepLink = {
  contentId: string;
  piece: PieceId;
  /** True only when the id is in the named rotation. Drives the gate bypass. */
  featured: boolean;
  /** The rotation that vouched for it, for telemetry. Null unless `featured`. */
  rotationId: string | null;
};

export function resolveMiniGameDeepLink(args: {
  contentId: string | undefined;
  rotationId?: string | undefined;
  pools: MiniGamePools;
}): MiniGameDeepLink | null {
  const { contentId, rotationId, pools } = args;
  if (!contentId) return null;

  const resolved = resolveChallenge(pools, contentId);
  if (!resolved) return null;

  const rotation = rotationId ? getRotation(rotationId) : undefined;
  const featured =
    resolved.engine.status === "early-access" &&
    Boolean(rotation?.items.includes(contentId));

  return {
    contentId,
    piece: resolved.piece,
    featured,
    rotationId: featured ? rotation!.id : null,
  };
}
