"use client";

import { useEffect, useState } from "react";

import { useThemeAsset } from "@/lib/themes/use-theme-asset";
import {
  DUEL_LOBBY_ROTATION_MS,
  DUEL_LOBBY_SLOTS,
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

/** Which lobby images actually exist. Empty means "show the board". */
export function useDuelLobbySlides(): string[] {
  // ⚠️ Hooks cannot be called in a loop, so the three slots are read by name.
  // It is also why the count is fixed rather than configurable.
  const first = useThemeAsset(DUEL_LOBBY_SLOTS[0], "default");
  const second = useThemeAsset(DUEL_LOBBY_SLOTS[1], "default");
  const third = useThemeAsset(DUEL_LOBBY_SLOTS[2], "default");

  return lobbySlides([first, second, third]);
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
