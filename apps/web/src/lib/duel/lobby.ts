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

/**
 * ⛔ ONE SET PER LANGUAGE, because the text is BAKED INTO the image.
 *
 * These are not screenshots with a caption underneath: the headline, the
 * feature copy and the price all live inside the artwork. A single set would
 * mean showing Spanish promos to an English player, and no amount of UI
 * translation would fix it — the words are pixels.
 *
 * ⚠️ Order matters: it is the rotation order the player sees.
 */
const SLOTS_BY_LOCALE: Record<"en" | "es", readonly ThemeAssetKey[]> = {
  en: ["arena.duel-lobby-en-1", "arena.duel-lobby-en-2", "arena.duel-lobby-en-3"],
  es: ["arena.duel-lobby-es-1", "arena.duel-lobby-es-2", "arena.duel-lobby-es-3"],
};

/**
 * The three slots for a locale.
 *
 * ⛔ STRICTLY per language, with NO cross-language fallback, and that is a
 * decision rather than an omission. Falling back to the other set would mean
 * uploading a Spanish image silently changes what an English player sees — a
 * surprise nobody could reason about from the builder. Empty means the board,
 * which is the one fallback that is always correct.
 *
 * An unknown locale gets English: it is the source language of the copy.
 */
export function duelLobbySlots(locale: string): readonly ThemeAssetKey[] {
  return locale === "es" ? SLOTS_BY_LOCALE.es : SLOTS_BY_LOCALE.en;
}

/** Every slot of every language, for the guards that check the catalog. */
export const DUEL_LOBBY_SLOTS: readonly ThemeAssetKey[] = [
  ...SLOTS_BY_LOCALE.en,
  ...SLOTS_BY_LOCALE.es,
];

/** How long each image holds before the next one. Long enough to read a tip,
 *  short enough that a player who glanced away sees the other ones. */
export const DUEL_LOBBY_ROTATION_MS = 6_000;

/**
 * The slots that actually have a file behind them.
 *
 * ⛔ It returns SLOT KEYS, not paths, and that is the fix for a real bug. What
 * `useThemeAsset` answers is a BASENAME with no extension
 * (`/art/…/duel-lobby-es-1`); the `<picture>` with its `.avif/.webp/.png`
 * sources is built by `ThemeAssetPicture`. Feeding that basename to a raw
 * `<img src>` renders a broken image with the alt text on top — which is
 * exactly what the first upload produced.
 *
 * ⚠️ An empty base means "nothing was uploaded here" and is not a failure.
 * Gaps are allowed: with only the second slot filled, that one shows.
 */
export function lobbySlides<K extends string>(
  entries: ReadonlyArray<{ slot: K; base: string }>,
): K[] {
  return entries
    .filter(({ base }) => typeof base === "string" && base.trim() !== "")
    .map(({ slot }) => slot);
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
