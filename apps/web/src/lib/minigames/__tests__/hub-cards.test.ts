import { describe, expect, it } from "vitest";

import {
  challengeHref,
  completedChallengeIds,
  deriveMiniGamesHubView,
} from "@/lib/minigames/hub-cards";
import { baselineMiniGamePools } from "@/lib/minigames/pools";
import { FEATURED_LIMIT, resolveChallengePool } from "@/lib/minigames/queue";

const pools = baselineMiniGamePools();
const pool = resolveChallengePool(pools);

function view(bestsByPiece: Record<string, Record<string, number>> = {}) {
  return deriveMiniGamesHubView({ pools, bestsByPiece });
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
    expect(view().cards).toHaveLength(FEATURED_LIMIT);
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

  it("reports the player's position in the pool", () => {
    expect(view().poolSize).toBe(pool.length);
    expect(view().completedCount).toBe(0);
    const one = view(completing([pool[0]!.challengeId]));
    expect(one.completedCount).toBe(1);
    expect(one.poolSize).toBe(pool.length);
  });
});

describe("what the player has done decides what they see", () => {
  it("two different histories produce two different sets", () => {
    const fresh = view().cards.map((c) => c.challengeId);
    const advanced = view(completing(fresh)).cards.map((c) => c.challengeId);
    expect(advanced).not.toEqual(fresh);
  });

  /** AC-6 / AC-11: an existing completion shows through immediately, and it is
   *  read from the SAME per-piece best map the drawer has always written. */
  it("shows a completion the moment its best exists", () => {
    const target = pool[0]!;
    // Complete EVERYTHING, so the exhausted set is drawn from completed
    // challenges and this one is certainly on screen with its own history.
    const result = view(completing(pool.map((entry) => entry.challengeId)));
    const card = result.cards.find((c) => c.challengeId === target.challengeId);
    expect(card?.state).toBe("FEATURED_COMPLETED");
  });

  it("flags an unplayed challenge NEW and a completed one not", () => {
    expect(view().cards.every((card) => card.isNew)).toBe(true);
    const all = pool.map((entry) => entry.challengeId);
    expect(view(completing(all)).cards.every((card) => card.isNew)).toBe(false);
  });

  it("reports exhausted only when every healthy challenge has a best", () => {
    expect(view().exhausted).toBe(false);
    const all = pool.map((entry) => entry.challengeId);
    const done = view(completing(all));
    expect(done.exhausted).toBe(true);
    // ⛔ Still renders cards: the section returns null on an empty list, so an
    // empty exhausted state would delete the whole group from the home.
    expect(done.cards).toHaveLength(FEATURED_LIMIT);
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
