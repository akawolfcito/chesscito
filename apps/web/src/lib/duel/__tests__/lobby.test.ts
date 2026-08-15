import { describe, it, expect } from "vitest";

import {
  DUEL_LOBBY_SLOTS,
  lobbySlides,
  nextSlide,
  shouldRotate,
} from "../lobby";
import { THEME_SLOT_SURFACES } from "@/lib/themes/theme-registry";

describe("the slots", () => {
  /**
   * ⚠️ Classified as `play`, and that is not bookkeeping: the surface map is
   * what puts a slot in front of the founder in the builder catalog. Left
   * `unknown` — which is what an unclassified slot silently becomes — there
   * would be no way to upload anything into it, and the feature would look
   * broken rather than unconfigured.
   */
  it("are real slots the builder can author, on the PLAY surface", () => {
    for (const slot of DUEL_LOBBY_SLOTS) {
      expect(THEME_SLOT_SURFACES[slot]).toBe("play");
    }
  });

  it("are three, in the order they rotate", () => {
    expect(DUEL_LOBBY_SLOTS).toEqual([
      "arena.duel-lobby-1",
      "arena.duel-lobby-2",
      "arena.duel-lobby-3",
    ]);
  });
});

describe("lobbySlides", () => {
  /**
   * ⛔ THE FALLBACK. `useThemeAsset` answers `""` for a slot with no file, so
   * an empty result means "nothing uploaded" and the caller shows the board.
   * Nothing here may leave the waiting screen emptier than it already was.
   */
  it("finds nothing when no image has been uploaded", () => {
    expect(lobbySlides(["", "", ""])).toEqual([]);
    expect(lobbySlides([])).toEqual([]);
  });

  it("keeps only the ones that exist, in order", () => {
    expect(lobbySlides(["/art/a", "", "/art/c"])).toEqual(["/art/a", "/art/c"]);
  });

  /** ⚠️ Gaps are allowed: filling only the second slot shows the second one. */
  it("does not need the first slot to be filled", () => {
    expect(lobbySlides(["", "/art/b", ""])).toEqual(["/art/b"]);
  });

  it("treats a blank string as no image", () => {
    expect(lobbySlides(["   ", "/art/b"])).toEqual(["/art/b"]);
  });
});

describe("shouldRotate", () => {
  /** ⛔ A carousel of one is a timer that changes nothing, and it would still
   *  cost a re-render every few seconds for as long as the player waits. */
  it("does not rotate a single image, or none", () => {
    expect(shouldRotate([])).toBe(false);
    expect(shouldRotate(["/art/a"])).toBe(false);
  });

  it("rotates as soon as there are two", () => {
    expect(shouldRotate(["/art/a", "/art/b"])).toBe(true);
  });
});

describe("nextSlide", () => {
  it("wraps around the end", () => {
    expect(nextSlide(0, 3)).toBe(1);
    expect(nextSlide(2, 3)).toBe(0);
  });

  it("stays put when there is nothing to advance to", () => {
    expect(nextSlide(0, 0)).toBe(0);
    expect(nextSlide(0, 1)).toBe(0);
  });
});
