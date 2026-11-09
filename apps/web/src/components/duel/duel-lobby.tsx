"use client";

import { useEffect, useMemo, useState } from "react";

import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";
import { useThemeAsset } from "@/lib/themes/use-theme-asset";
import type { ThemeAssetKey } from "@/lib/themes/theme-registry";
import {
  DUEL_LOBBY_ROTATION_MS,
  nextSlide,
  shouldRotate,
} from "@/lib/duel/lobby";

/**
 * The waiting screen's space for something to look at.
 *
 * ⛔ THE FALLBACK IS THE DESIGN: with no image uploaded, the player sees the
 * BOARD, exactly as before. An empty slot must never become an empty rectangle
 * — nor, as it turned out, a broken one.
 *
 * ⚠️ AND THE RESOLVER CANNOT TELL US WHETHER A FILE EXISTS. Measured, not
 * assumed: `resolveThemeAsset` answers a DETERMINISTIC path for every
 * catalogued slot — `/art/theme-builder/<theme>/<slot>/default` — whether or
 * not anything was ever uploaded there. The registry's "no default → renders
 * nothing" is about the ENTRY, not about this theme's map. So an emptiness
 * check on the resolver is always false, and the first upload attempt showed
 * three broken images with the alt text on top.
 *
 * The only thing that knows is the network, so each candidate is PROBED and
 * only the ones that actually load are shown. Until a probe comes back, the
 * list is empty and the board holds the screen — the fallback is also the
 * initial state, so there is no flash of a broken image.
 */

/**
 * ⚠️ `.png` is the EXISTENCE ORACLE, not what gets shown.
 *
 * The uploader writes the triplet together, so asking after any one member
 * answers for all three — and `.png` is the only one every browser can be
 * assumed to have. What the player actually downloads is chosen by `<picture>`,
 * which will pick `.avif` or `.webp` and never this.
 */
const PROBE_EXTENSION = ".png";

/**
 * Does this asset exist?
 *
 * ⛔ A HEAD request, NOT `new Image()`. Loading the image to find out would
 * download the heaviest member of the triplet in full, just to throw it away
 * and then let `<picture>` fetch the light one — paying for the big file on a
 * screen whose whole point is that it costs nothing.
 *
 * ⚠️ And it checks the CONTENT TYPE, not just the status. A dev server or a
 * rewrite happily answers `200 text/html` for a missing asset, and treating
 * that as "the image is there" is how a broken picture ships.
 */
async function probe(url: string): Promise<boolean> {
  if (typeof fetch === "undefined") return false;
  try {
    const response = await fetch(url, { method: "HEAD", cache: "force-cache" });
    if (!response.ok) return false;
    return (response.headers.get("content-type") ?? "").startsWith("image/");
  } catch {
    return false;
  }
}

/**
 * Which lobby slots have art FOR THIS LANGUAGE that actually loads.
 *
 * ⛔ The text is baked into the artwork, so each language has its own set and
 * there is no crossing over: with the Spanish images loaded and the English
 * ones empty, an English player sees the board rather than Spanish promos.
 */
export function useDuelLobbySlides(locale: string): ThemeAssetKey[] {
  // ⚠️ Hooks cannot be called in a loop or conditionally, so ALL SIX slots are
  // read on every render and the language picks which three count. Reading only
  // the current locale's three would change the hook order on a language
  // switch, which React forbids.
  const en1 = useThemeAsset("arena.duel-lobby-en-1", "default");
  const en2 = useThemeAsset("arena.duel-lobby-en-2", "default");
  const en3 = useThemeAsset("arena.duel-lobby-en-3", "default");
  const es1 = useThemeAsset("arena.duel-lobby-es-1", "default");
  const es2 = useThemeAsset("arena.duel-lobby-es-2", "default");
  const es3 = useThemeAsset("arena.duel-lobby-es-3", "default");

  const candidates = useMemo(
    () =>
      locale === "es"
        ? [
            { slot: "arena.duel-lobby-es-1" as ThemeAssetKey, base: es1 },
            { slot: "arena.duel-lobby-es-2" as ThemeAssetKey, base: es2 },
            { slot: "arena.duel-lobby-es-3" as ThemeAssetKey, base: es3 },
          ]
        : [
            { slot: "arena.duel-lobby-en-1" as ThemeAssetKey, base: en1 },
            { slot: "arena.duel-lobby-en-2" as ThemeAssetKey, base: en2 },
            { slot: "arena.duel-lobby-en-3" as ThemeAssetKey, base: en3 },
          ],
    [locale, en1, en2, en3, es1, es2, es3],
  );

  // ⛔ Starts EMPTY, and that is the point: the board holds the screen until an
  // image is confirmed to load.
  const [loadable, setLoadable] = useState<ThemeAssetKey[]>([]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      candidates.map(async ({ slot, base }) =>
        base && (await probe(`${base}${PROBE_EXTENSION}`)) ? slot : null,
      ),
    ).then((results) => {
      if (cancelled) return;
      setLoadable(results.filter((slot): slot is ThemeAssetKey => slot !== null));
    });
    return () => {
      cancelled = true;
    };
  }, [candidates]);

  return loadable;
}

export function DuelLobby({
  slides,
  alt,
}: {
  slides: ThemeAssetKey[];
  alt: string;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!shouldRotate(slides)) return;
    const timer = setInterval(
      () => setIndex((current) => nextSlide(current, slides.length)),
      DUEL_LOBBY_ROTATION_MS,
    );
    return () => clearInterval(timer);
  }, [slides]);

  if (slides.length === 0) return null;

  // A slot emptied while the carousel was mid-rotation would leave the index
  // past the end; clamping beats rendering nothing.
  const current = slides[Math.min(index, slides.length - 1)];

  return (
    <div className="duel-lobby">
      {/* ⛔ `ThemeAssetPicture`, never a raw `<img>`: the registry stores a
          BASENAME with no extension, and the `<picture>` with its
          `.avif/.webp/.png` sources is what turns it into a file that exists. */}
      <ThemeAssetPicture
        slot={current}
        alt={alt}
        pictureClassName="duel-lobby-picture"
        className="duel-lobby-image"
      />
      {slides.length > 1 ? (
        <div className="duel-lobby-dots" aria-hidden="true">
          {slides.map((slide, i) => (
            <span
              key={slide}
              className={`duel-lobby-dot${i === index ? " is-active" : ""}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
