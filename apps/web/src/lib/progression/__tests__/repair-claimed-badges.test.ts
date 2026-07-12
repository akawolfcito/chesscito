import { describe, expect, it } from "vitest";

import { computeRepairClaimedBadges } from "../repair-claimed-badges";
import type { MilestoneStore } from "../types";

/**
 * The device repair for the stuck badge overlay.
 *
 * Not deriving `piece-badge-eligible` for an owned badge stops NEW profiles
 * from getting stuck — it does nothing for the profiles that already are. Their
 * store holds a pending `piece-badge-eligible:<piece>` for a badge that is
 * already on chain, and `selectPending` is global: it re-opens "Badge Ready to
 * Claim" on every solve of every piece, forever. The event has to be laid to
 * rest on disk.
 *
 * The rule is narrow on purpose: consume ONLY the recognition whose badge the
 * chain says is already minted. An earned-but-unclaimed badge is a celebration
 * the player is still owed, and stamping it would swallow it silently.
 */

const NOW = "2026-07-12T12:00:00.000Z";

function store(events: MilestoneStore["events"]): MilestoneStore {
  return { version: 1, events, dailyDate: "2026-07-12" };
}

describe("computeRepairClaimedBadges", () => {
  it("celebrates a pending eligibility whose badge is already on chain", () => {
    const next = computeRepairClaimedBadges(
      store({
        "piece-badge-eligible:rook": {
          id: "piece-badge-eligible",
          piece: "rook",
          earnedAt: "2026-07-01T00:00:00.000Z",
        },
      }),
      { rook: true },
      NOW,
    );

    expect(next.events["piece-badge-eligible:rook"].celebratedAt).toBe(NOW);
  });

  it("leaves an unclaimed badge pending — that celebration is still owed", () => {
    const input = store({
      "piece-badge-eligible:pawn": {
        id: "piece-badge-eligible",
        piece: "pawn",
        earnedAt: "2026-07-01T00:00:00.000Z",
      },
    });

    const next = computeRepairClaimedBadges(input, { pawn: false }, NOW);

    expect(next.events["piece-badge-eligible:pawn"].celebratedAt).toBeUndefined();
    // Same reference: nothing to write, so nothing is persisted.
    expect(next).toBe(input);
  });

  it("never touches other milestones", () => {
    const next = computeRepairClaimedBadges(
      store({
        "first-labyrinth:rook": {
          id: "first-labyrinth",
          piece: "rook",
          earnedAt: "2026-07-01T00:00:00.000Z",
        },
      }),
      { rook: true },
      NOW,
    );

    expect(next.events["first-labyrinth:rook"].celebratedAt).toBeUndefined();
  });

  it("is idempotent — an already-celebrated event is left alone", () => {
    const input = store({
      "piece-badge-eligible:rook": {
        id: "piece-badge-eligible",
        piece: "rook",
        earnedAt: "2026-07-01T00:00:00.000Z",
        celebratedAt: "2026-07-02T00:00:00.000Z",
      },
    });

    expect(computeRepairClaimedBadges(input, { rook: true }, NOW)).toBe(input);
  });
});
