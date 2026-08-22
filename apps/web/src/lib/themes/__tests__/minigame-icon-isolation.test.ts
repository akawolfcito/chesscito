/**
 * Collision guard for the Learn Hub mini-game icons.
 *
 * Twice now an icon refresh has landed by OVERWRITING a piece sprite. Both
 * times the cause was the same: a `hub.minigame.*` slot whose `default`
 * pointed at `/art/redesign/pieces/w-*`, so whoever exported the new tile
 * followed the path the slot declared and wrote it on top of the art the
 * real chessboard draws from. Nothing failed — the triplets were valid, the
 * `src` attributes never changed, and the VR tolerance (~3.7x a chip) does
 * not see a 23px sprite change its drawing. Only opening the file showed it.
 *
 * `/art/minigames/` exists precisely so the two can never collide. The first
 * time, only three of the six slots were moved there; the three left behind
 * were the ones that got overwritten next (2026-08-22: w-king, w-knight,
 * w-pawn). A comment is not a control — this is.
 *
 * Audit: docs/audits/2026-08-22-minigame-icon-update-collision.md
 */
import { describe, expect, it } from "vitest";

import { DEFAULT_THEME_ID, THEMES } from "../theme-registry";
import { resolveAssetVariant } from "../asset-variant";

const assets = THEMES[DEFAULT_THEME_ID].assets;

const MINIGAME_PREFIX = "hub.minigame.";

/** Every (slot, variant) pair that names a real basename. */
const targets = Object.entries(assets).flatMap(([key, entry]) =>
  (["default", "pro"] as const).flatMap((variant) => {
    const resolved = resolveAssetVariant(entry, variant);
    return resolved.mode === "asset"
      ? [{ key, variant, basename: resolved.path }]
      : [];
  }),
);

const minigameTargets = targets.filter(({ key }) =>
  key.startsWith(MINIGAME_PREFIX),
);

describe("mini-game icons own their art", () => {
  it("sees every mini-game slot", () => {
    // Guard the guard — a prefix typo would make everything below vacuous.
    const keys = new Set(minigameTargets.map(({ key }) => key));
    expect(keys.size).toBeGreaterThanOrEqual(6);
  });

  it("keeps every mini-game icon under /art/minigames/", () => {
    const strays = minigameTargets
      .filter(({ basename }) => !basename.startsWith("/art/minigames/"))
      .map(({ key, variant, basename }) => `${key} (${variant}) → ${basename}`);

    expect(strays).toEqual([]);
  });

  it("never shares a mini-game icon with another slot", () => {
    // The failure mode is sharing, not the folder: an icon reachable from a
    // second slot means refreshing one surface silently repaints the other.
    const collisions = minigameTargets.flatMap(({ key, basename }) =>
      targets
        .filter(
          (other) =>
            other.basename === basename &&
            !other.key.startsWith(MINIGAME_PREFIX),
        )
        .map((other) => `${key} shares ${basename} with ${other.key}`),
    );

    expect(collisions).toEqual([]);
  });
});
