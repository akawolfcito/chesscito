"use client";

import { useEffect, useRef } from "react";
import { seedMilestonesOnce, type SeedMilestonesArgs } from "./seed-milestones";

export type UseMilestoneSeedingArgs = SeedMilestonesArgs & {
  /** False while the on-chain badge state is still in flight. Seeding with a
   *  half-known profile would mark it migrated and leave `piece-badge-claimed`
   *  / `mastery` unseeded — a retroactive overlay for a badge minted months
   *  ago. A disconnected wallet is READY: `resolve()` would see the same
   *  `badgeClaimed: false` it does. */
  ready: boolean;
};

/**
 * Runs the one-time milestone migration for an existing player.
 *
 * WHERE THIS MUST MOUNT: on every surface that can reach `resolve()`. The
 * queue is resolved on the exercises screen, and a player can deep-link
 * straight to `/exercises` without ever passing through the hub — so seeding
 * on the hub alone would leave that player with a parade of retroactive
 * overlays on their first solve. It mounts on BOTH; `seedMilestonesOnce` is
 * idempotent (a persistent marker), so the second mount is a cheap no-op and
 * neither surface is the single writer of anything.
 *
 * WHEN: in a mount effect, NOT at module init. Seeding cannot beat the first
 * render — it never needed to. All it must beat is `resolve()`, which only
 * runs from a player action (a solve), and React flushes effects long before
 * any click can be delivered. The seed is COMMITTED TO DISK before the queue
 * is ever built.
 */
export function useMilestoneSeeding(args: UseMilestoneSeedingArgs): void {
  // Latest-value ref: the badge map and the catalog are fresh objects on every
  // render, so they cannot be effect dependencies without re-running the
  // migration on every paint. `ready` is the only real trigger.
  const argsRef = useRef(args);
  argsRef.current = args;

  useEffect(() => {
    if (!args.ready) return;
    const { badgeClaimedByPiece, labyrinthIdsByPiece, giftAvailable } =
      argsRef.current;
    seedMilestonesOnce({
      badgeClaimedByPiece,
      labyrinthIdsByPiece,
      giftAvailable,
    });
  }, [args.ready]);
}
