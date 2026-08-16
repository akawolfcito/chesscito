"use client";

import { useEffect, useState } from "react";

import { useThemeAsset } from "@/lib/themes/use-theme-asset";
import {
  DUEL_LOBBY_ROTATION_MS,
  lobbySlides,
  nextSlide,
  shouldRotate,
} from "@/lib/duel/lobby";

/**
 * The waiting screen's space for something to look at.
 *
 * ⛔ THE FALLBACK IS THE DESIGN: with no image uploaded, the player sees the
 * BOARD, exactly as before. An empty slot must never become an empty rectangle.
 *
 * ⚠️ Which is why the "are there any slides" question is answered by a HOOK the
 * PARENT calls, and not inside the component. A component that renders `null`
 * is still a truthy JSX element to its caller, so `{<DuelLobby/> ?? <Board/>}`
 * would silently drop the board forever. That mistake was made and caught here;
 * splitting the hook out is what makes it impossible to make again.
 *
 * Three fixed slots, authored from the theme builder like every other piece of
 * art. A theme slot is ONE file, so an arbitrary list would need its own table,
 * route and builder UI — a content pipeline, not a screen.
 */

/**
 * Which lobby images exist FOR THIS LANGUAGE. Empty means "show the board".
 *
 * ⛔ The text is baked into the artwork, so each language has its own set and
 * there is no crossing over: with the Spanish images loaded and the English
 * ones empty, an English player sees the board rather than Spanish promos.
 */
export function useDuelLobbySlides(locale: string): string[] {
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

  const forLocale = locale === "es" ? [es1, es2, es3] : [en1, en2, en3];
  return lobbySlides(forLocale);
}

export function DuelLobby({ slides, alt }: { slides: string[]; alt: string }) {
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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="duel-lobby-image" src={current} alt={alt} />
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
