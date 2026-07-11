import type { PieceId } from "@/lib/game/types";

/** Every recognizable moment in the LEARN progression ladder.
 *  `piece-badge-eligible` is the RIGHT to claim (10 stars reached).
 *  `piece-badge-claimed` is the confirmed on-chain mint. They are two
 *  events because a badge does not exist until a transaction confirms. */
export type MilestoneId =
  | "first-reward"
  | "first-labyrinth"
  | "special-training"
  | "piece-badge-eligible"
  | "piece-badge-claimed"
  | "mastery"
  | "great-focus-session"
  | "first-great-session";

/** Milestones that lead somewhere. Only these carry `openedAt` — a Great
 *  Focus Session, a claimed badge and a mastery crown are recognitions,
 *  not destinations, so an "opened" flag on them would mean nothing. */
export const NAVIGABLE_MILESTONES: readonly MilestoneId[] = [
  "first-reward",
  "first-labyrinth",
  "special-training",
] as const;

export type MilestoneEvent = {
  id: MilestoneId;
  /** Scopes per-piece milestones. Absent on global ones. */
  piece?: PieceId;
  /** ISO timestamp the condition first became true. */
  earnedAt: string;
  /** Set once the celebration overlay has actually been shown. */
  celebratedAt?: string;
  /** Set the first time the player opens the content. Clears the NEW dot.
   *  Only ever written for a milestone in NAVIGABLE_MILESTONES. */
  openedAt?: string;
};

/** Idempotency key. Per-piece milestones are scoped; global ones are not. */
export function milestoneKey(id: MilestoneId, piece?: PieceId): string {
  return piece ? `${id}:${piece}` : id;
}

export type MilestoneStore = {
  version: 1;
  /** Keyed by `milestoneKey()`. A present entry means the event fired. */
  events: Record<string, MilestoneEvent>;
  /** UTC date the daily milestones were last reset. */
  dailyDate: string | null;
};

export const EMPTY_STORE: MilestoneStore = {
  version: 1,
  events: {},
  dailyDate: null,
};
