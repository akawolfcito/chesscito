import type { PieceId, PieceProgress } from "@/lib/game/types";
import { readPieceStars } from "@/lib/game/exercise-progress";
import { areAllLabyrinthsSolved } from "@/lib/game/labyrinth-progress";
import { milestoneSeedStorageKey } from "@/lib/lite-progress-storage";
import { getWelcomePackageState } from "@/lib/welcome-package/storage";
import { gatherMilestoneInput } from "./gather-input";
import { seedExistingPlayer } from "./migration";
import { getMilestoneStore, persistMilestoneStore } from "./milestone-storage";
import type { MilestoneStore } from "./types";

const PIECES: readonly PieceId[] = [
  "rook",
  "bishop",
  "knight",
  "pawn",
  "queen",
  "king",
];

export type SeedMilestonesArgs = {
  /** On-chain claim state per piece. A piece absent from the map reads as
   *  "not claimed" — the same thing `resolve()` would see. */
  badgeClaimedByPiece: Partial<Record<PieceId, boolean>>;
  /** The labyrinth catalog, per piece. `mastery` needs it. */
  labyrinthIdsByPiece: Partial<Record<PieceId, readonly string[]>>;
  /** The gift is a Lite-only product — see `MilestoneInput.giftAvailable`. */
  giftAvailable: boolean;
};

/** Every piece's persisted stars, straight off the disk.
 *
 *  Deliberately NOT taken from React state: `starsPerPiece` only arrives in a
 *  post-mount effect, so a seed that waited for it would either read empty
 *  progress (and seed nothing) or land after the screen had already resolved.
 *  localStorage is synchronous and is the same source those effects read. */
function readProgressByPiece(): Partial<Record<PieceId, PieceProgress>> {
  const out: Partial<Record<PieceId, PieceProgress>> = {};
  for (const piece of PIECES) {
    out[piece] = { piece, currentId: null, stars: readPieceStars(piece) };
  }
  return out;
}

/** A piece the player has actually touched. `seedExistingPlayer` is scoped to
 *  ONE piece (`MilestoneInput.piece` scopes `first-labyrinth`,
 *  `piece-badge-*` and `mastery`), so seeding only for rook would hand a
 *  second-piece veteran a retroactive parade the day a second piece ships. */
function piecesWithProgress(
  progressByPiece: Partial<Record<PieceId, PieceProgress>>,
): PieceId[] {
  return PIECES.filter((piece) => {
    const stars = progressByPiece[piece]?.stars ?? {};
    return Object.values(stars).some((value) => value > 0);
  });
}

/** Pure core: folds one `seedExistingPlayer` pass per played piece over the
 *  store. Exported for tests — production goes through `seedMilestonesOnce`. */
export function computeSeededStore(
  store: MilestoneStore,
  progressByPiece: Partial<Record<PieceId, PieceProgress>>,
  args: SeedMilestonesArgs,
  welcomeClaimed: boolean,
  now: string,
): MilestoneStore {
  let next = store;
  for (const piece of piecesWithProgress(progressByPiece)) {
    const input = gatherMilestoneInput({
      piece,
      progressByPiece,
      // Today's session is NOT history. `great-focus-session` and
      // `first-great-session` are still up for grabs, and `seedExistingPlayer`
      // refuses to seed them anyway — these zeros just say the same thing
      // twice, and keep a live session from leaking into a migration.
      dailyStars: 0,
      sessionQuotaExhausted: false,
      badgeClaimed: args.badgeClaimedByPiece[piece] === true,
      allLabyrinthsComplete: areAllLabyrinthsSolved(
        piece,
        args.labyrinthIdsByPiece[piece] ?? [],
      ),
      hadGreatSessionBefore: false,
      giftAvailable: args.giftAvailable,
    });
    next = seedExistingPlayer(next, input, welcomeClaimed, now);
  }
  return next;
}

export function hasSeededMilestones(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(milestoneSeedStorageKey()) !== null;
  } catch {
    // No storage → no migration. Refusing to seed is the safe read: seeding
    // is what SUPPRESSES overlays, and a store we cannot persist would make
    // every mount re-seed from scratch.
    return true;
  }
}

/** Stamps the profile as migrated. Written even when nothing was seeded (a
 *  brand-new player): the marker means "the migration ran", not "the player
 *  had history". Without that, a new player would keep re-entering the
 *  migration path after every solve — and eat their own celebrations. */
export function markMilestonesSeeded(now = new Date().toISOString()): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(milestoneSeedStorageKey(), now);
  } catch {
    // Quota or privacy mode — nothing to do.
  }
}

/**
 * The migration. Stamps `celebratedAt` (and `openedAt` where the milestone is
 * navigable) on every milestone an existing player already passed, so the
 * upgrade never fires a retroactive parade: state preserved, overlay
 * suppressed.
 *
 * Runs AT MOST ONCE per profile, guarded by `milestoneSeedStorageKey()`. That
 * guard is load-bearing, not an optimization: an event that is earned and
 * still awaiting its celebration is indistinguishable, on disk, from one that
 * was never seeded. Re-running the seed later would stamp it celebrated and
 * silently eat the overlay the player was owed.
 *
 * Returns the store it committed, or `null` when the profile was already
 * migrated.
 */
export function seedMilestonesOnce(
  args: SeedMilestonesArgs,
  now: string = new Date().toISOString(),
): MilestoneStore | null {
  if (typeof window === "undefined") return null;
  if (hasSeededMilestones()) return null;

  const store = getMilestoneStore();
  const next = computeSeededStore(
    store,
    readProgressByPiece(),
    args,
    getWelcomePackageState().claimed,
    now,
  );
  // Persist BEFORE the marker: a write that fails must not be recorded as a
  // migration that ran.
  if (next !== store) persistMilestoneStore(next);
  markMilestonesSeeded(now);
  return next;
}
