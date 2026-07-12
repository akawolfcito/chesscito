import { deriveEarnedMilestones, type MilestoneInput } from "./milestones";
import {
  milestoneKey,
  NAVIGABLE_MILESTONES,
  type MilestoneEvent,
  type MilestoneId,
  type MilestoneStore,
} from "./types";

/** Daily milestones are never seeded: today's session is still live and the
 *  player deserves the chance to earn it. */
const NEVER_SEEDED: readonly MilestoneId[] = [
  "great-focus-session",
  "first-great-session",
];

/** Stamps every milestone an existing player already passed as celebrated,
 *  so upgrading the app never fires a retroactive parade. State preserved,
 *  overlay suppressed. Idempotent: returns the same reference once seeded. */
export function seedExistingPlayer(
  store: MilestoneStore,
  input: MilestoneInput,
  welcomeClaimed: boolean,
  now: string,
): MilestoneStore {
  const earned = deriveEarnedMilestones(input).filter(
    (event) => !NEVER_SEEDED.includes(event.id),
  );
  const fresh = earned.filter(
    (event) => !store.events[milestoneKey(event.id, event.piece)],
  );
  if (fresh.length === 0) return store;

  const events = { ...store.events };
  for (const event of fresh) {
    const record: MilestoneEvent = {
      id: event.id,
      earnedAt: now,
      celebratedAt: now,
    };
    if (event.piece) record.piece = event.piece;

    if (NAVIGABLE_MILESTONES.includes(event.id)) {
      // The gift is the ONE navigable milestone with a pre-existing claim
      // state, so it is the only one that can still owe the player a NEW dot.
      // An unclaimed gift keeps its dot; a claimed gift and every other
      // milestone the player has already lived through count as opened.
      const opened = event.id === "first-reward" ? welcomeClaimed : true;
      if (opened) record.openedAt = now;
    }

    events[milestoneKey(event.id, event.piece)] = record;
  }
  return { ...store, events };
}
