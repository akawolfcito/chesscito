import type { PieceId } from "@/lib/game/types";
import {
  LABYRINTH_MIN_EXERCISES,
  LABYRINTH_UNLOCK_THRESHOLD,
} from "@/lib/training/path";
import type { MilestoneId } from "./types";

/** The gift is a once-ever event, so it reads once-ever counters. A daily
 *  threshold would strand a player who earns 3 stars on Monday and 1 on
 *  Tuesday: the counter resets at UTC midnight and the gift never lands. */
export const GIFT_STARS = 4;
export const GIFT_EXERCISES = 2;

export const SPECIAL_TRAINING_ROOK_STARS = 12;

export const GREAT_SESSION_STARS = 8;

export type MilestoneInput = {
  /** The piece currently under play — scopes the per-piece milestones. */
  piece: PieceId;
  /** Best exercise stars summed across every piece. Cumulative. */
  lifetimeStars: number;
  /** Exercises solved at least once, across every piece. Cumulative. */
  completedExercises: number;
  /** Best exercise stars for `piece`. Labyrinth stars NEVER count here.
   *  Reward/tiebreak metric only — no longer gates the badge. */
  pieceStars: number;
  /** Exercises of `piece` solved at least once. */
  pieceCompletedExercises: number;
  /** Exercises the piece must complete to earn its badge (80% of the pool). */
  pieceRequiredExercises: number;
  /** Rook exercise stars — the Special Training gate. */
  rookStars: number;
  /** Net stars earned today, exercises AND labyrinths. */
  dailyStars: number;
  sessionQuotaExhausted: boolean;
  /** On-chain claim state for `piece`. */
  badgeClaimed: boolean;
  allLabyrinthsComplete: boolean;
  /** Whether a Great Focus Session was ever recognized before today. */
  hadGreatSessionBefore: boolean;
  /**
   * Whether the Welcome Package gift can actually be delivered in this build.
   * The gift is a Lite-only product — `useWelcomePackage()` and
   * `unlockWelcomePackageGift()` are both no-ops in Full mode — so a Full
   * build must not celebrate an unlock it can never hand over. Defaults to
   * `true`: the gift is assumed available unless the caller says otherwise.
   */
  giftAvailable?: boolean;
};

export type EarnedMilestone = {
  id: MilestoneId;
  piece?: PieceId;
};

/** Pure. Returns every milestone whose condition is currently TRUE — it does
 *  NOT know or care which ones already fired. Idempotence lives in storage. */
export function deriveEarnedMilestones(input: MilestoneInput): EarnedMilestone[] {
  const earned: EarnedMilestone[] = [];
  const { piece } = input;

  if (
    (input.giftAvailable ?? true) &&
    input.lifetimeStars >= GIFT_STARS &&
    input.completedExercises >= GIFT_EXERCISES
  ) {
    earned.push({ id: "first-reward" });
  }

  if (
    input.pieceStars >= LABYRINTH_UNLOCK_THRESHOLD &&
    input.pieceCompletedExercises >= LABYRINTH_MIN_EXERCISES
  ) {
    earned.push({ id: "first-labyrinth", piece });
  }

  if (input.rookStars >= SPECIAL_TRAINING_ROOK_STARS) {
    earned.push({ id: "special-training" });
  }

  if (
    input.pieceRequiredExercises > 0 &&
    input.pieceCompletedExercises >= input.pieceRequiredExercises
  ) {
    // The RIGHT to claim does not survive the claim. Deriving it for an owned
    // badge kept `piece-badge-eligible` permanently earned, and the queue
    // drains EVERY pending event regardless of the piece on screen — so one
    // stuck eligibility re-opened "Badge Ready to Claim" on every solve of
    // every other piece, and its CTA no-ops on an owned badge, so it could
    // never be celebrated away. The two events are exclusive states of one
    // badge, not a sequence.
    if (input.badgeClaimed) {
      earned.push({ id: "piece-badge-claimed", piece });
    } else {
      earned.push({ id: "piece-badge-eligible", piece });
    }
  }

  // The crown cannot rest on a badge that was never minted.
  if (input.badgeClaimed && input.allLabyrinthsComplete) {
    earned.push({ id: "mastery", piece });
  }

  const greatSession =
    input.dailyStars >= GREAT_SESSION_STARS || input.sessionQuotaExhausted;
  if (greatSession) {
    earned.push({ id: "great-focus-session" });
    if (!input.hadGreatSessionBefore) {
      earned.push({ id: "first-great-session" });
    }
  }

  return earned;
}
