/**
 * What the waiting screen shows while nobody has answered the link.
 *
 * ⛔ THE FALLBACK IS THE PRODUCT DECISION: with no image loaded, the player
 * sees the BOARD, exactly as before. Nothing about this feature can leave the
 * waiting screen emptier than it already was — an empty slot must never become
 * an empty rectangle.
 *
 * ⚠️ Three fixed slots, not an arbitrary list, and that is a deliberate ceiling
 * rather than a limitation nobody thought about. A theme slot is ONE file; a
 * list of N would need its own table, its own route and its own builder UI —
 * a content pipeline, not a screen. Three covers "rotate a couple of things
 * while you wait" with the machinery that already exists, and the day ten are
 * needed, that is the moment the pipeline earns its spec.
 */

import type { ThemeAssetKey } from "@/lib/themes/theme-registry";

/** ⚠️ Order matters: it is the rotation order the player sees. */
export const DUEL_LOBBY_SLOTS: readonly ThemeAssetKey[] = [
  "arena.duel-lobby-1",
  "arena.duel-lobby-2",
  "arena.duel-lobby-3",
];

/** How long each image holds before the next one. Long enough to read a tip,
 *  short enough that a player who glanced away sees the other ones. */
export const DUEL_LOBBY_ROTATION_MS = 6_000;

/**
 * The slides that actually exist.
 *
 * `useThemeAsset` answers `""` for a slot with no file behind it, so an empty
 * string is "nothing was uploaded here" and not a bug. Gaps are allowed: with
 * only the second slot filled, that one shows.
 */
export function lobbySlides(resolved: readonly string[]): string[] {
  return resolved.filter((src) => typeof src === "string" && src.trim() !== "");
}

/**
 * ⛔ A single image does NOT rotate. A carousel of one is a timer that changes
 * nothing, and it would still cost a re-render every six seconds forever.
 */
export function shouldRotate(slides: readonly string[]): boolean {
  return slides.length > 1;
}

/** The slide after `index`, wrapping. */
export function nextSlide(index: number, total: number): number {
  if (total <= 0) return 0;
  return (index + 1) % total;
}
