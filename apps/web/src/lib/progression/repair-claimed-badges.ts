import type { PieceId } from "@/lib/game/types";
import { getMilestoneStore, persistMilestoneStore } from "./milestone-storage";
import { milestoneKey, type MilestoneStore } from "./types";

/**
 * Lays to rest a `piece-badge-eligible` event whose badge is already on chain.
 *
 * `deriveEarnedMilestones` used to emit the eligibility even for an owned
 * badge, so profiles built before that fix carry a PENDING recognition for a
 * badge they minted long ago. `selectPending` is global — it does not care
 * which piece is on screen — so that one stuck event re-opened "Badge Ready to
 * Claim" on every solve of every piece, over boards showing far fewer than ten
 * stars. Tapping its CTA changed nothing: `handleClaimBadge` no-ops on an owned
 * badge, so the event was never celebrated and the loop fed itself.
 *
 * Not deriving it any more stops NEW profiles from getting stuck; it does
 * nothing for the ones already on disk. This does.
 *
 * Deliberately narrow: it consumes ONLY the recognition whose badge the chain
 * says is minted. An earned-but-unclaimed badge is a celebration the player is
 * still owed, and stamping that would swallow it in silence.
 *
 * Idempotent, and returns the SAME reference when there is nothing to do, so
 * the caller can skip the write.
 */
export function computeRepairClaimedBadges(
  store: MilestoneStore,
  badgeClaimedByPiece: Partial<Record<PieceId, boolean>>,
  now: string,
): MilestoneStore {
  const stuck = Object.values(store.events).filter(
    (event) =>
      event.id === "piece-badge-eligible" &&
      !event.celebratedAt &&
      event.piece !== undefined &&
      badgeClaimedByPiece[event.piece] === true,
  );
  if (stuck.length === 0) return store;

  const events = { ...store.events };
  for (const event of stuck) {
    events[milestoneKey(event.id, event.piece)] = {
      ...event,
      celebratedAt: now,
    };
  }
  return { ...store, events };
}

/** IO wrapper. Safe to call on every mount: it writes only when a stuck event
 *  is actually present. */
export function repairClaimedBadges(
  badgeClaimedByPiece: Partial<Record<PieceId, boolean>>,
  now: string = new Date().toISOString(),
): MilestoneStore {
  const current = getMilestoneStore();
  const next = computeRepairClaimedBadges(current, badgeClaimedByPiece, now);
  if (next !== current) persistMilestoneStore(next);
  return next;
}
