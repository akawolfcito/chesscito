"use client";

import { useEffect, useRef } from "react";
import { seedMilestonesOnce, type SeedMilestonesArgs } from "./seed-milestones";

export type UseMilestoneSeedingArgs = SeedMilestonesArgs & {
  /** False while the on-chain badge state is still in flight. Seeding with a
   *  half-known profile would mark it migrated and leave `piece-badge-claimed`
   *  / `mastery` unseeded — a retroactive overlay for a badge minted months
   *  ago. A disconnected wallet is READY: `resolve()` would see the same
   *  `badgeClaimed: false` it does. Build it with `isMilestoneSeedReady`. */
  ready: boolean;
};

/** wagmi's `useAccount().status`. Declared structurally so this module does not
 *  drag wagmi into a pure unit. */
export type AccountStatus =
  | "connected"
  | "connecting"
  | "reconnecting"
  | "disconnected";

/**
 * THE seeding gate. Every surface that seeds must use this one — the hub and
 * the exercises screen disagreeing about what "ready" means is how a profile
 * gets stamped migrated with half its badges unknown.
 *
 * - `disconnected` → READY. There is no wallet, so there are no badges, and
 *   that is exactly what a `resolve()` would see. A wallet-less player must
 *   seed, or they never get past the migration.
 * - `connecting` / `reconnecting` → NOT ready. The address is still undefined,
 *   the badge read is DISABLED, and a disabled TanStack query reports
 *   `isLoading === false` — the trap the old `!isBadgesLoading` gate fell into.
 * - `connected` → ready only once the badge state is actually KNOWN. On an
 *   unsupported chain `getBadgesAddress()` is null, the read never enables and
 *   `badgeStateKnown` stays false FOREVER. That is intentional: an unknown
 *   badge state is not "no badges". Seeding it as badge-less would leave the
 *   veteran's real, months-old badges unseeded, and they would pop as fresh
 *   `piece-badge-claimed` / `mastery` overlays the moment the player switched
 *   back to the right chain. The profile stays unseeded instead — and
 *   `resolveMilestones` refuses to run at all while unseeded, so the wrong
 *   chain costs the player nothing but a delay.
 */
export function isMilestoneSeedReady(args: {
  accountStatus: AccountStatus | undefined;
  /** True once the on-chain badge read has actually produced an answer. */
  badgeStateKnown: boolean;
}): boolean {
  if (args.accountStatus === "disconnected") return true;
  return args.accountStatus === "connected" && args.badgeStateKnown;
}

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
