import { describe, expect, it } from "vitest";
import { seedExistingPlayer } from "@/lib/progression/migration";
import { EMPTY_STORE } from "@/lib/progression/types";
import type { MilestoneInput } from "@/lib/progression/milestones";

const NOW = "2026-07-11T10:00:00.000Z";

function input(overrides: Partial<MilestoneInput> = {}): MilestoneInput {
  return {
    piece: "rook",
    lifetimeStars: 0,
    completedExercises: 0,
    pieceStars: 0,
    pieceCompletedExercises: 0,
    rookStars: 0,
    dailyStars: 0,
    sessionQuotaExhausted: false,
    badgeClaimed: false,
    allLabyrinthsComplete: false,
    hadGreatSessionBefore: false,
    ...overrides,
  };
}

describe("seedExistingPlayer", () => {
  it("leaves a brand new player untouched", () => {
    const seeded = seedExistingPlayer(EMPTY_STORE, input(), false, NOW);
    expect(seeded.events).toEqual({});
  });

  it("suppresses the overlay for a player already past 12 rook stars", () => {
    const seeded = seedExistingPlayer(
      EMPTY_STORE,
      input({ rookStars: 12, lifetimeStars: 12, completedExercises: 5 }),
      true,
      NOW,
    );
    expect(seeded.events["special-training"].celebratedAt).toBe(NOW);
  });

  it("marks a claimed gift as opened so no NEW dot reappears", () => {
    const seeded = seedExistingPlayer(
      EMPTY_STORE,
      input({ lifetimeStars: 6, completedExercises: 3 }),
      true,
      NOW,
    );
    expect(seeded.events["first-reward"].celebratedAt).toBe(NOW);
    expect(seeded.events["first-reward"].openedAt).toBe(NOW);
  });

  it("keeps the NEW dot for a gift earned but never claimed", () => {
    const seeded = seedExistingPlayer(
      EMPTY_STORE,
      input({ lifetimeStars: 6, completedExercises: 3 }),
      false,
      NOW,
    );
    expect(seeded.events["first-reward"].celebratedAt).toBe(NOW);
    expect(seeded.events["first-reward"].openedAt).toBeUndefined();
  });

  it("never seeds a daily milestone — today's session is still up for grabs", () => {
    const seeded = seedExistingPlayer(
      EMPTY_STORE,
      input({ dailyStars: 8 }),
      false,
      NOW,
    );
    expect(seeded.events["great-focus-session"]).toBeUndefined();
    expect(seeded.events["first-great-session"]).toBeUndefined();
  });

  it("is a no-op on a store that was already seeded", () => {
    const first = seedExistingPlayer(EMPTY_STORE, input({ rookStars: 12 }), true, NOW);
    const second = seedExistingPlayer(
      first,
      input({ rookStars: 12 }),
      true,
      "2026-07-12T10:00:00.000Z",
    );
    expect(second).toBe(first);
  });
});
