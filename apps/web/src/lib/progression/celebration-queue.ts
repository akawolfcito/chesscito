import type { PieceId } from "@/lib/game/types";
import type { EarnedMilestone } from "./milestones";
import type { MilestoneId } from "./types";

/** Incremental unlocks. Each gets its own overlay because each carries a CTA
 *  to different content. None of them concludes anything — they invite action. */
const INCREMENTAL_ORDER: MilestoneId[] = [
  "first-reward",
  "first-labyrinth",
  "special-training",
];

/** Majors, highest hierarchy first. Exactly ONE renders per drain; every
 *  other major that fired is absorbed as a line inside it. Showing MASTERY!
 *  and then GREAT FOCUS SESSION! drops the intensity after the climax. */
const CLOSER_ORDER: MilestoneId[] = [
  "mastery",
  "piece-badge-eligible",
  "great-focus-session",
];

export type CelebrationStep = {
  id: MilestoneId;
  piece?: PieceId;
  /** Lower majors rendered as lines inside this overlay, never as modals.
   *
   *  Carries the FULL event, piece and all — not a bare id. The absorbed
   *  events do not necessarily share the closer's scope: a piece-scoped
   *  closer (`mastery:rook`) routinely absorbs GLOBAL events
   *  (`great-focus-session`). Storing only the id forced the dismiss path to
   *  re-attach the closer's piece, building the key `great-focus-session:rook`
   *  — which matches no event, so the absorbed event was never marked
   *  celebrated and popped again as a stray overlay on the next solve. */
  absorbed: EarnedMilestone[];
};

export function buildCelebrationQueue(
  pending: readonly EarnedMilestone[],
): CelebrationStep[] {
  const find = (id: MilestoneId) => pending.find((event) => event.id === id);

  const steps: CelebrationStep[] = [];

  for (const id of INCREMENTAL_ORDER) {
    const event = find(id);
    if (event) steps.push({ id, piece: event.piece, absorbed: [] });
  }

  const firedClosers = CLOSER_ORDER.filter((id) => find(id));
  if (firedClosers.length === 0) return steps;

  const [closerId, ...absorbedClosers] = firedClosers;
  const closer = find(closerId);
  // `absorbedClosers` only holds ids `find` already resolved, so every lookup
  // below is guaranteed to hit — the filter is for the type, not for safety.
  const absorbed: EarnedMilestone[] = absorbedClosers
    .map((id) => find(id))
    .filter((event): event is EarnedMilestone => Boolean(event));

  // first-great-session is an achievement, never an overlay of its own.
  const firstGreatSession = find("first-great-session");
  if (firstGreatSession) absorbed.push(firstGreatSession);

  steps.push({ id: closerId, piece: closer?.piece, absorbed });
  return steps;
}
