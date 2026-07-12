import type { ContextAction } from "@/lib/game/context-action";
import type { WelcomePackTileState } from "@/components/exercises/welcome-pack-tile";
import type { PieceId, PieceProgress } from "@/lib/game/types";
import { readPieceStars } from "@/lib/game/exercise-progress";
import { getMilestoneStore } from "@/lib/progression/milestone-storage";
import { milestoneKey, type MilestoneId } from "@/lib/progression/types";
import { CHESSCITO_LITE_MODE } from "@/lib/feature-flags";
import {
  getWelcomePackageState,
  setWelcomePackageState,
} from "@/lib/welcome-package/storage";

const PIECES: PieceId[] = ["rook", "bishop", "knight", "pawn", "queen", "king"];

/**
 * Every piece's persisted best-stars map, shaped for `gatherMilestoneInput`.
 *
 * `freshStars` is REQUIRED for the piece under play. `useExerciseProgress`
 * persists inside a `setProgress` updater, so at the moment the milestone
 * machine is asked to evaluate (same tick as the solve) the localStorage
 * write has NOT landed yet. Reading it back would evaluate the milestone
 * conditions against the board as it was BEFORE the solve — the badge that
 * the tenth star just earned would only surface on the next completion.
 */
export function buildProgressByPiece(
  piece: PieceId,
  freshStars: Record<string, number>,
): Partial<Record<PieceId, PieceProgress>> {
  const out: Partial<Record<PieceId, PieceProgress>> = {};
  for (const id of PIECES) {
    out[id] = {
      piece: id,
      currentId: null,
      stars: id === piece ? freshStars : readPieceStars(id),
    };
  }
  return out;
}

/** The stars map a solve leaves behind: best-of, sparse, never regressing. */
export function withBestStars(
  stars: Record<string, number>,
  exerciseId: string,
  earned: number,
): Record<string, number> {
  const best = Math.max(stars[exerciseId] ?? 0, earned);
  if (best <= 0) return stars;
  return { ...stars, [exerciseId]: best };
}

/** True when the milestone is already on disk (earned, whether or not it has
 *  been celebrated). Reads the store, never the live queue. */
export function hasEarnedMilestone(id: MilestoneId, piece?: PieceId): boolean {
  return Boolean(getMilestoneStore().events[milestoneKey(id, piece)]);
}

/**
 * Bridges the `first-reward` milestone to the Welcome Package gift.
 *
 * The gift tile gates on `welcomePackage.unlocked && !claimed`
 * (`lib/hub/content-loop.ts`). Nothing in `lib/progression/**` writes that
 * flag — `migration.ts` only READS `welcomeClaimed`. Without this bridge the
 * milestone would render a celebration for a gift that is unreachable
 * forever. Idempotent, Lite-only (the gift does not exist in Full mode,
 * matching `useWelcomePackage().unlock()`).
 */
export function unlockWelcomePackageGift(): void {
  if (!CHESSCITO_LITE_MODE) return;
  const prev = getWelcomePackageState();
  if (prev.unlocked) return;
  setWelcomePackageState({
    ...prev,
    unlocked: true,
    unlockedAt: new Date().toISOString(),
  });
}

/**
 * True when the post-3-stars "Connect to save" prompt should fire.
 * Suppressed in Lite: score-save is local-only and needs no wallet gate.
 */
export function shouldFireStarsConnectPrompt(opts: {
  isConnected: boolean;
  liteMode: boolean;
  stars: number;
}): boolean {
  return !opts.isConnected && !opts.liteMode && opts.stars === 3;
}

/**
 * True when the local-save "Saved" toast should fire after exercise completion.
 * Guard: labyrinth completions have their own overlay and must not receive it.
 * This function is called inside autoReset.schedule(..., 1500) in both the
 * normal-advance path and the badge-earned path — never synchronously on
 * completeExercise() (spec P0-2).
 */
export function shouldFireLocalSavedToast(opts: {
  labyrinthMode: boolean;
}): boolean {
  return !opts.labyrinthMode;
}

/**
 * True when the Welcome Pack inline CTA should occupy the contextual slot.
 * Lite-only, idle slot (contextAction===null), after client hydration, and
 * while pack is not yet claimed. Badge actions exclude themselves via
 * contextAction (getContextAction returns "claimBadge" when badgeClaimable).
 */
export function shouldShowWPCtaInSlot(opts: {
  liteMode: boolean;
  contextAction: ContextAction | null;
  wpMounted: boolean;
  wpState: WelcomePackTileState;
}): boolean {
  return (
    opts.liteMode &&
    opts.contextAction === null &&
    opts.wpMounted &&
    opts.wpState !== "claimed"
  );
}
