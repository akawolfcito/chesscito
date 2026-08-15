import { describe, it, expect } from "vitest";

import { shouldPlayIntro } from "../intro";
import type { DuelArenaState } from "../arena-state";

type Kind = DuelArenaState["kind"];

const ALL: Kind[] = [
  "loading",
  "missing",
  "inviting",
  "invited",
  "your-turn",
  "their-turn",
  "watching",
  "finished",
  "expired",
];

describe("shouldPlayIntro", () => {
  /** The whole point: the game starting in front of you, from either side. */
  it("plays when the wait ends, for the inviter and for the guest", () => {
    expect(shouldPlayIntro("inviting", "your-turn")).toBe(true);
    expect(shouldPlayIntro("inviting", "their-turn")).toBe(true);
    expect(shouldPlayIntro("invited", "your-turn")).toBe(true);
    expect(shouldPlayIntro("invited", "their-turn")).toBe(true);
  });

  /**
   * ⛔ THE FAILURE THIS GUARDS. Firing on "the duel is active" instead of "the
   * duel just became active" replays "Get ready!" on every reload of a game
   * forty moves deep, and on every poll that re-rendered.
   */
  it("never plays for a game that was already under way", () => {
    expect(shouldPlayIntro(null, "your-turn")).toBe(false);
    expect(shouldPlayIntro("your-turn", "their-turn")).toBe(false);
    expect(shouldPlayIntro("their-turn", "your-turn")).toBe(false);
    expect(shouldPlayIntro("loading", "your-turn")).toBe(false);
  });

  /** ⚠️ Somebody opening a forwarded link to watch is not starting a game. */
  it("never plays for a spectator", () => {
    for (const previous of ALL) {
      expect(shouldPlayIntro(previous, "watching")).toBe(false);
    }
  });

  it("never plays into a state that is not a live game", () => {
    for (const current of ["loading", "missing", "inviting", "invited", "finished", "expired"] as Kind[]) {
      for (const previous of ALL) {
        expect(shouldPlayIntro(previous, current)).toBe(false);
      }
    }
  });

  /** A duel that ends the moment it starts (the flag fell while waiting) goes
   *  straight to its result, with no ceremony in between. */
  it("does not play when the wait ends in an ending", () => {
    expect(shouldPlayIntro("inviting", "expired")).toBe(false);
    expect(shouldPlayIntro("invited", "finished")).toBe(false);
  });
});
