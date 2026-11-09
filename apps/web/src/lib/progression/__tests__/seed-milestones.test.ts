import { beforeEach, describe, expect, it } from "vitest";
import {
  labyrinthBestStorageKey,
  milestoneSeedStorageKey,
  milestoneStorageKey,
  pieceProgressStorageKey,
} from "@/lib/lite-progress-storage";
import { getMilestoneStore } from "@/lib/progression/milestone-storage";
import {
  hasSeededMilestones,
  markMilestonesSeeded,
  seedMilestonesOnce,
  type SeedMilestonesArgs,
} from "@/lib/progression/seed-milestones";
import { setWelcomePackageState, DEFAULT_STATE } from "@/lib/welcome-package/storage";
import type { PieceId } from "@/lib/game/types";

const NOW = "2026-07-12T10:00:00.000Z";

function args(overrides: Partial<SeedMilestonesArgs> = {}): SeedMilestonesArgs {
  return {
    badgeClaimedByPiece: {},
    labyrinthIdsByPiece: {},
    giftAvailable: true,
    ...overrides,
  };
}

function seedStars(piece: PieceId, stars: Record<string, number>) {
  localStorage.setItem(
    pieceProgressStorageKey(piece),
    JSON.stringify({ piece, currentId: null, stars }),
  );
}

/** Eight 3★ exercises — 80% of a 10-exercise pool, past the badge COMPLETION
 *  gate and every star gate in the ladder. */
const VETERAN_STARS = {
  e1: 3, e2: 3, e3: 3, e4: 3, e5: 3, e6: 3, e7: 3, e8: 3,
};

beforeEach(() => {
  localStorage.clear();
});

describe("seedMilestonesOnce", () => {
  it("stamps every already-passed milestone as celebrated", () => {
    seedStars("rook", VETERAN_STARS);
    seedMilestonesOnce(args(), NOW);

    const events = getMilestoneStore().events;
    expect(events["first-reward"].celebratedAt).toBe(NOW);
    expect(events["first-labyrinth:rook"].celebratedAt).toBe(NOW);
    expect(events["special-training"].celebratedAt).toBe(NOW);
    expect(events["piece-badge-eligible:rook"].celebratedAt).toBe(NOW);
  });

  /** HAZARD 3. `seedExistingPlayer` is scoped to ONE piece: its
   *  `MilestoneInput.piece` scopes `first-labyrinth`, `piece-badge-*` and
   *  `mastery`. Seeding only for rook would hand a second-piece veteran a
   *  retroactive parade the day a second piece ships. */
  it("seeds EVERY piece the player has progress on, not just rook", () => {
    seedStars("rook", VETERAN_STARS);
    seedStars("bishop", VETERAN_STARS);

    seedMilestonesOnce(args(), NOW);

    const events = getMilestoneStore().events;
    expect(events["first-labyrinth:bishop"].celebratedAt).toBe(NOW);
    expect(events["piece-badge-eligible:bishop"].celebratedAt).toBe(NOW);
    // A piece never played stays untouched — nothing to suppress.
    expect(events["first-labyrinth:knight"]).toBeUndefined();
  });

  it("seeds mastery only when the badge is claimed AND every maze is solved", () => {
    seedStars("rook", VETERAN_STARS);
    localStorage.setItem(
      labyrinthBestStorageKey("rook"),
      JSON.stringify({ "rook-lab-1": 4, "rook-lab-2": 6 }),
    );

    seedMilestonesOnce(
      args({
        badgeClaimedByPiece: { rook: true },
        labyrinthIdsByPiece: { rook: ["rook-lab-1", "rook-lab-2"] },
      }),
      NOW,
    );

    const events = getMilestoneStore().events;
    expect(events["piece-badge-claimed:rook"].celebratedAt).toBe(NOW);
    expect(events["mastery:rook"].celebratedAt).toBe(NOW);
  });

  it("marks a claimed gift as opened so no NEW dot reappears", () => {
    seedStars("rook", VETERAN_STARS);
    setWelcomePackageState({ ...DEFAULT_STATE, unlocked: true, claimed: true });

    seedMilestonesOnce(args(), NOW);

    expect(getMilestoneStore().events["first-reward"].openedAt).toBe(NOW);
  });

  it("keeps the NEW dot on a gift that was earned but never claimed", () => {
    seedStars("rook", VETERAN_STARS);

    seedMilestonesOnce(args(), NOW);

    const gift = getMilestoneStore().events["first-reward"];
    expect(gift.celebratedAt).toBe(NOW);
    expect(gift.openedAt).toBeUndefined();
  });

  it("never seeds today's session milestones", () => {
    seedStars("rook", VETERAN_STARS);
    seedMilestonesOnce(args(), NOW);

    const events = getMilestoneStore().events;
    expect(events["great-focus-session"]).toBeUndefined();
    expect(events["first-great-session"]).toBeUndefined();
  });

  it("does not celebrate a gift that a Full build can never deliver", () => {
    seedStars("rook", VETERAN_STARS);
    seedMilestonesOnce(args({ giftAvailable: false }), NOW);

    expect(getMilestoneStore().events["first-reward"]).toBeUndefined();
  });

  /** HAZARD 4. Idempotence on disk is "this key exists", NOT "the migration
   *  ran". A milestone that was legitimately EARNED and is still awaiting its
   *  celebration is indistinguishable from one that was never seeded — a
   *  second seeding pass would stamp it celebrated and EAT the overlay. The
   *  marker is what makes this a one-time upgrade path. */
  it("refuses to run twice, so it can never eat a pending celebration", () => {
    seedStars("rook", VETERAN_STARS);
    markMilestonesSeeded(NOW);

    // The player earns a milestone the normal way: recorded, not yet celebrated.
    localStorage.setItem(
      milestoneStorageKey(),
      JSON.stringify({
        version: 1,
        events: {
          "special-training": { id: "special-training", earnedAt: NOW },
        },
        dailyDate: NOW.slice(0, 10),
      }),
    );

    expect(seedMilestonesOnce(args(), NOW)).toBeNull();
    const event = getMilestoneStore().events["special-training"];
    expect(event.celebratedAt).toBeUndefined();
    // And no milestone was invented behind the player's back.
    expect(getMilestoneStore().events["first-reward"]).toBeUndefined();
  });

  it("stamps a brand-new player as migrated without celebrating anything", () => {
    expect(hasSeededMilestones()).toBe(false);

    seedMilestonesOnce(args(), NOW);

    expect(getMilestoneStore().events).toEqual({});
    expect(hasSeededMilestones()).toBe(true);
    expect(localStorage.getItem(milestoneSeedStorageKey())).toBe(NOW);
  });

  /** An event already on disk is the player's, not the migration's. Seeding
   *  must never overwrite `earnedAt` — or a pending celebration's timestamp. */
  it("leaves an existing event untouched", () => {
    seedStars("rook", VETERAN_STARS);
    localStorage.setItem(
      milestoneStorageKey(),
      JSON.stringify({
        version: 1,
        events: {
          "first-reward": { id: "first-reward", earnedAt: "2026-01-01T00:00:00.000Z" },
        },
        dailyDate: NOW.slice(0, 10),
      }),
    );

    seedMilestonesOnce(args(), NOW);

    const gift = getMilestoneStore().events["first-reward"];
    expect(gift.earnedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(gift.celebratedAt).toBeUndefined();
    // The rest of the ladder still got seeded around it.
    expect(getMilestoneStore().events["special-training"].celebratedAt).toBe(NOW);
  });
});
