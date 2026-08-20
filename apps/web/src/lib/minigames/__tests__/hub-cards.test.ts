import { describe, expect, it } from "vitest";

import {
  deriveMiniGamesHubView,
  featuredChallengeHref,
  launchEngineIds,
} from "@/lib/minigames/hub-cards";
import { baselineMiniGamePools } from "@/lib/minigames/pools";
import {
  ACTIVE_ROTATION_ID,
  MINIGAME_ROTATIONS,
  getActiveRotation,
} from "@/lib/minigames/rotation";

const pools = baselineMiniGamePools();

function view(bestsByPiece: Record<string, Record<string, number>> = {}) {
  return deriveMiniGamesHubView({
    rotation: getActiveRotation(),
    pools,
    bestsByPiece,
  });
}

describe("deriveMiniGamesHubView", () => {
  it("builds one card per featured challenge, in rotation order", () => {
    expect(view().cards.map((card) => card.challengeId)).toEqual([
      ...getActiveRotation().items,
    ]);
  });

  it("carries the rotation id", () => {
    expect(view().rotationId).toBe(ACTIVE_ROTATION_ID);
  });

  /** AC-5: nothing in the derivation can produce a locked or purchasable card,
   *  because nothing in it reads a balance. */
  it("every card is a FEATURED_* state — no lock, no price", () => {
    for (const card of view().cards) {
      expect(card.state.startsWith("FEATURED_")).toBe(true);
    }
  });

  it("AC-9: announces exactly the two coming-soon engines", () => {
    expect(view().comingSoon.sort()).toEqual(["knight-tour", "promotion-run"]);
  });

  it("never features a coming-soon engine", () => {
    for (const card of view().cards) {
      expect(view().comingSoon).not.toContain(card.engineId);
    }
  });

  it("flags every card new in the first rotation (there is no previous one)", () => {
    expect(view().cards.every((card) => card.isNew)).toBe(true);
  });

  /** AC-6 / AC-11: an existing completion shows through immediately, and it is
   *  read from the SAME per-piece best map the drawer has always written. */
  it("reflects an existing completion as FEATURED_COMPLETED", () => {
    const first = getActiveRotation().items[0];
    const piece = view().cards[0].piece;
    const result = view({ [piece]: { [first]: 5 } });
    expect(result.cards[0].state).toBe("FEATURED_COMPLETED");
  });

  it("reports rotationComplete only when every featured challenge has a best", () => {
    expect(view().rotationComplete).toBe(false);
    const bests: Record<string, Record<string, number>> = {};
    for (const card of view().cards) {
      bests[card.piece] = { ...(bests[card.piece] ?? {}), [card.challengeId]: 4 };
    }
    expect(view(bests).rotationComplete).toBe(true);
  });

  /** AC-10 / AC-11 — the rotation contract, stated once.
   *  Swapping the rotation swaps the cards and NOTHING else: the same stored
   *  bests keep reading as completions for whichever challenges they cover. */
  it("AC-10/AC-11: changing rotation changes the cards, never the completions", () => {
    const done = { queen: { "queens-1": 4 }, rook: { "rook-rail-two-roads": 6 } };
    const first = deriveMiniGamesHubView({
      rotation: MINIGAME_ROTATIONS[0],
      pools,
      bestsByPiece: done,
    });
    const second = deriveMiniGamesHubView({
      rotation: MINIGAME_ROTATIONS[1],
      pools,
      bestsByPiece: done,
    });

    expect(first.cards.map((c) => c.challengeId)).not.toEqual(
      second.cards.map((c) => c.challengeId),
    );
    // The completions recorded under rotation 1 are still completions; they
    // simply are not on screen any more. Nothing was revoked.
    const stillCompleted = deriveMiniGamesHubView({
      rotation: MINIGAME_ROTATIONS[0],
      pools,
      bestsByPiece: done,
    });
    expect(
      stillCompleted.cards.filter((c) => c.state === "FEATURED_COMPLETED").length,
    ).toBe(2);
    // …and a challenge featured for the first time in rotation 2 is untouched
    // by rotation 1's history.
    expect(second.cards.every((c) => c.state !== "FEATURED_COMPLETED")).toBe(true);
  });

  it("marks a challenge carried over from the previous rotation as not new", () => {
    const carried = deriveMiniGamesHubView({
      rotation: { id: MINIGAME_ROTATIONS[1].id, items: MINIGAME_ROTATIONS[0].items },
      pools,
      bestsByPiece: {},
    });
    expect(carried.cards.every((card) => card.isNew)).toBe(false);
  });
});

describe("launchEngineIds", () => {
  it("is exactly the four early-access engines", () => {
    expect(launchEngineIds().sort()).toEqual([
      "n-queens",
      "pivot-run",
      "rook-rail",
      "safe-path",
    ]);
  });
});

describe("featuredChallengeHref", () => {
  it("carries both the content id and the vouching rotation", () => {
    expect(featuredChallengeHref("queens-1", "early-access-1")).toBe(
      "/exercises?content=queens-1&featured=early-access-1",
    );
  });

  it("encodes its parameters", () => {
    expect(featuredChallengeHref("a b&c", "r&1")).toBe(
      "/exercises?content=a%20b%26c&featured=r%261",
    );
  });
});
