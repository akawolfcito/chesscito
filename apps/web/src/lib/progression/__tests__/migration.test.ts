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

  it("stamps EVERY milestone celebratedAt on a full returning player", () => {
    const seeded = seedExistingPlayer(
      EMPTY_STORE,
      input({
        rookStars: 14,
        lifetimeStars: 14,
        completedExercises: 6,
        pieceStars: 14,
        pieceCompletedExercises: 6,
        badgeClaimed: true,
        allLabyrinthsComplete: true,
        hadGreatSessionBefore: true,
      }),
      true,
      NOW,
    );

    // Every seeded event must have celebratedAt
    expect(Object.values(seeded.events).every((event) => event.celebratedAt)).toBe(true);

    // Guard against vacuous pass — verify the expected milestones are present
    expect(seeded.events["first-reward"]).toBeDefined();
    expect(seeded.events["first-labyrinth:rook"]).toBeDefined();
    expect(seeded.events["special-training"]).toBeDefined();
    expect(seeded.events["piece-badge-eligible:rook"]).toBeDefined();
    expect(seeded.events["piece-badge-claimed:rook"]).toBeDefined();
    expect(seeded.events["mastery:rook"]).toBeDefined();
  });

  it("never seeds daily milestones even when sessionQuotaExhausted is true", () => {
    const seeded = seedExistingPlayer(
      EMPTY_STORE,
      input({
        sessionQuotaExhausted: true,
        dailyStars: 0,
        hadGreatSessionBefore: false,
      }),
      false,
      NOW,
    );
    expect(seeded.events["great-focus-session"]).toBeUndefined();
    expect(seeded.events["first-great-session"]).toBeUndefined();
  });
});
