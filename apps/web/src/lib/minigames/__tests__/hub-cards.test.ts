import { describe, expect, it } from "vitest";

import {
  challengeHref,
  completedChallengeIds,
  deriveMiniGamesHubView,
} from "@/lib/minigames/hub-cards";
import { baselineMiniGamePools } from "@/lib/minigames/pools";
import { DAILY_NEW_SLOTS } from "@/lib/minigames/daily-window";
import { resolveChallengePool } from "@/lib/minigames/queue";

const pools = baselineMiniGamePools();
const pool = resolveChallengePool(pools);

const WINDOW = "2026-08-21";

function view(
  bestsByPiece: Record<string, Record<string, number>> = {},
  stored: { windowId: string; assigned: string[] } | null = null,
  windowId = WINDOW,
) {
  return deriveMiniGamesHubView({ pools, bestsByPiece, stored, windowId });
}

/** Mark a challenge completed the way the game does: a recorded best under its
 *  piece. Never a hand-written id list — the point is that the view reads the
 *  SAME map the drawer has always written. */
function completing(challengeIds: readonly string[]) {
  const bests: Record<string, Record<string, number>> = {};
  for (const id of challengeIds) {
    const entry = pool.find((candidate) => candidate.challengeId === id)!;
    bests[entry.piece] = { ...(bests[entry.piece] ?? {}), [id]: 4 };
  }
  return bests;
}

describe("deriveMiniGamesHubView — personal, not global", () => {
  it("builds one card per featured slot", () => {
    expect(view().cards).toHaveLength(DAILY_NEW_SLOTS);
  });

  it("carries the challenge title, which is what the tile now names", () => {
    for (const card of view().cards) {
      expect(typeof card.title).toBe("string");
      expect(card.title.length).toBeGreaterThan(0);
      // ⚠️ Not an equality against an authored string: titles are content and
      // the builder may change them. What must hold is that the card names the
      // CHALLENGE and not the engine id.
      expect(card.title).not.toBe(card.engineId);
    }
  });

  /** AC-5: nothing in the derivation can produce a locked or purchasable card,
   *  because nothing in it reads a balance. */
  it("every card is a FEATURED_* state — no lock, no price", () => {
    for (const card of view().cards) {
      expect(card.state.startsWith("FEATURED_")).toBe(true);
    }
  });

  it("AC-9: announces exactly the two coming-soon engines", () => {
    expect(view().comingSoon.slice().sort()).toEqual(["knight-tour", "promotion-run"]);
  });

  it("never features a coming-soon engine", () => {
    const soon = view().comingSoon;
    for (const card of view().cards) expect(soon).not.toContain(card.engineId);
  });

  it("reports TODAY, never the catalogue", () => {
    const fresh = view();
    expect(fresh.completedToday).toBe(0);
    expect(fresh.slotCount).toBe(DAILY_NEW_SLOTS);
    // ⛔ There is no pool-size field to leak onto the Home any more.
    expect("poolSize" in fresh).toBe(false);

    const assigned = fresh.assignment;
    const one = view(completing([assigned.assigned[0]!]), assigned);
    expect(one.completedToday).toBe(1);
    expect(one.slotCount).toBe(DAILY_NEW_SLOTS);
  });

  it("hands back the assignment to persist, and says when it changed", () => {
    const fresh = view();
    expect(fresh.assignmentChanged).toBe(true);
    expect(fresh.assignment.windowId).toBe(WINDOW);
    // Re-deriving the same window must not ask for a pointless write.
    expect(view({}, fresh.assignment).assignmentChanged).toBe(false);
  });
});

describe("what the player has done decides what they see", () => {
  /** ⛔ THE DAILY BOUNDARY, at the view level. Completing all three does NOT
   *  change the set inside the same window — that is the entire pass. It
   *  changes at the NEXT window. */
  it("keeps the same set all window, then advances at the boundary", () => {
    const day1 = view();
    const ids = day1.cards.map((c) => c.challengeId);

    const sameWindow = view(completing(ids), day1.assignment, WINDOW);
    expect(sameWindow.cards.map((c) => c.challengeId)).toEqual(ids);
    expect(sameWindow.completedToday).toBe(DAILY_NEW_SLOTS);

    const nextWindow = view(completing(ids), day1.assignment, "2026-08-22");
    expect(nextWindow.cards.map((c) => c.challengeId)).not.toEqual(ids);
    expect(nextWindow.completedToday).toBe(0);
  });

  /** AC-6 / AC-11: an existing completion shows through immediately, and it is
   *  read from the SAME per-piece best map the drawer has always written. */
  it("shows a completion the moment its best exists", () => {
    const day1 = view();
    const target = day1.cards[0]!.challengeId;
    const result = view(completing([target]), day1.assignment);
    const card = result.cards.find((c) => c.challengeId === target);
    expect(card?.state).toBe("FEATURED_COMPLETED");
  });

  it("flags an unplayed challenge NEW and a completed one not", () => {
    const day1 = view();
    expect(day1.cards.every((card) => card.isNew)).toBe(true);
    const done = view(completing(day1.cards.map((c) => c.challengeId)), day1.assignment);
    expect(done.cards.every((card) => card.isNew)).toBe(false);
  });

  it("reports the pool exhausted only when every healthy challenge has a best", () => {
    expect(view().poolExhausted).toBe(false);
    const all = pool.map((entry) => entry.challengeId);
    const done = view(completing(all));
    expect(done.poolExhausted).toBe(true);
    // ⛔ Still renders cards: the section returns null on an empty list, so an
    // empty exhausted state would delete the whole group from the home.
    expect(done.cards.length).toBeGreaterThan(0);
  });

  /** AC-11 — nothing about what is on screen can revoke a completion. */
  it("never revokes a completion, whatever is featured", () => {
    const done = [pool[0]!.challengeId, pool[pool.length - 1]!.challengeId];
    const before = completedChallengeIds(completing(done));
    // Advance the queue by completing more, then confirm the originals survive.
    const after = completedChallengeIds(completing([...done, pool[1]!.challengeId]));
    for (const id of before) expect(after.has(id)).toBe(true);
  });
});

describe("completedChallengeIds", () => {
  it("flattens every piece's bests into one set", () => {
    const set = completedChallengeIds({ rook: { a: 1 }, queen: { b: 2 } });
    expect([...set].sort()).toEqual(["a", "b"]);
  });

  it("survives an absent or empty piece map", () => {
    expect(completedChallengeIds({ rook: undefined, queen: {} }).size).toBe(0);
    expect(completedChallengeIds({}).size).toBe(0);
  });
});

describe("challengeHref", () => {
  it("names the origin, which decides the bypass AND the return", () => {
    expect(challengeHref("queens-1", "featured")).toBe(
      "/exercises?content=queens-1&from=featured",
    );
    expect(challengeHref("queens-1", "library")).toBe(
      "/exercises?content=queens-1&from=library",
    );
  });

  it("encodes the content id", () => {
    expect(challengeHref("a b&c", "library")).toBe(
      "/exercises?content=a%20b%26c&from=library",
    );
  });
});
