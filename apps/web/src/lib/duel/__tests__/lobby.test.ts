import { describe, it, expect } from "vitest";

import {
  DUEL_LOBBY_SLOTS,
  duelLobbySlots,
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

  it("are six: three images in each of the two languages", () => {
    expect(DUEL_LOBBY_SLOTS).toHaveLength(6);
  });
});

describe("duelLobbySlots", () => {
  /**
   * ⛔ The text is BAKED INTO the artwork, so a single set would show Spanish
   * promos to an English player and no UI translation could fix it: the words
   * are pixels.
   */
  it("gives each language its own three", () => {
    expect(duelLobbySlots("es")).toEqual([
      "arena.duel-lobby-es-1",
      "arena.duel-lobby-es-2",
      "arena.duel-lobby-es-3",
    ]);
    expect(duelLobbySlots("en")).toEqual([
      "arena.duel-lobby-en-1",
      "arena.duel-lobby-en-2",
      "arena.duel-lobby-en-3",
    ]);
  });

  /**
   * ⛔ NO cross-language fallback, and that is a decision. Falling back to the
   * other set would mean uploading a Spanish image silently changes what an
   * English player sees — a surprise nobody could reason about from the
   * builder. Empty means the board, which is always correct.
   */
  it("never reaches into the other language", () => {
    for (const slot of duelLobbySlots("es")) expect(slot).toContain("-es-");
    for (const slot of duelLobbySlots("en")) expect(slot).toContain("-en-");
  });

  /** An unknown locale gets English: it is the source language of the copy. */
  it("falls back to English for a locale it does not know", () => {
    expect(duelLobbySlots("pt")).toEqual(duelLobbySlots("en"));
    expect(duelLobbySlots("")).toEqual(duelLobbySlots("en"));
  });
});

describe("lobbySlides", () => {
  const entry = (slot: string, base: string) => ({ slot, base });

  /**
   * ⛔ THE FALLBACK. `useThemeAsset` answers "" for a slot with no file, so an
   * empty result means "nothing uploaded" and the caller shows the board.
   */
  it("finds nothing when no image has been uploaded", () => {
    expect(lobbySlides([entry("a", ""), entry("b", "")])).toEqual([]);
    expect(lobbySlides([])).toEqual([]);
  });

  /**
   * ⛔ It returns SLOT KEYS, not paths. What the resolver answers is a BASENAME
   * with no extension; the <picture> that turns it into a real file is built by
   * ThemeAssetPicture. Handing the basename to a raw <img src> renders a broken
   * image with the alt text on top — which is what the first upload produced.
   */
  it("returns the slot, never the basename", () => {
    expect(lobbySlides([entry("arena.duel-lobby-es-1", "/art/whatever/es-1")])).toEqual([
      "arena.duel-lobby-es-1",
    ]);
  });

  it("keeps only the ones that exist, in order", () => {
    expect(
      lobbySlides([entry("a", "/art/a"), entry("b", ""), entry("c", "/art/c")]),
    ).toEqual(["a", "c"]);
  });

  /** ⚠️ Gaps are allowed: filling only the second slot shows the second one. */
  it("does not need the first slot to be filled", () => {
    expect(lobbySlides([entry("a", ""), entry("b", "/art/b")])).toEqual(["b"]);
  });

  it("treats a blank string as no image", () => {
    expect(lobbySlides([entry("a", "   "), entry("b", "/art/b")])).toEqual(["b"]);
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
