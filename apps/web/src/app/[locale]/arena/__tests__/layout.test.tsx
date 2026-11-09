import { describe, it, expect, vi, beforeEach } from "vitest";

const preloadMock = vi.hoisted(() => vi.fn());

vi.mock("react-dom", () => ({
  preload: preloadMock,
}));

import ArenaLayout from "../layout";

describe("/arena layout (server)", () => {
  beforeEach(() => {
    preloadMock.mockClear();
  });

  it("preloads the arena-scaffold background AVIF (the /arena LCP image)", () => {
    // Perf 2026-06-13: the /arena LCP element is main.arena-scaffold,
    // whose background is bg-ch via --playhub-game-bg (globals.css).
    // CSS-gated discovery cost ~1s of LCP Load Delay on mobile Slow-4G.
    // Same recipe as /hub: AVIF-only preload (MiniPay Chromium).
    ArenaLayout({ children: null });
    expect(preloadMock).toHaveBeenCalledWith("/art/redesign/bg/wallpaper-exercises.avif", {
      as: "image",
      type: "image/avif",
      fetchPriority: "high",
    });
  });

  it("passes children through without extra wrappers", () => {
    const marker = { kind: "children-marker" };
    expect(ArenaLayout({ children: marker as never })).toBe(marker);
  });

  it("does NOT preload the WebP/PNG fallbacks", () => {
    ArenaLayout({ children: null });
    const calls = preloadMock.mock.calls.map((args) => args[0] as string);
    expect(calls).not.toContain("/art/redesign/bg/wallpaper-exercises.webp");
    expect(calls).not.toContain("/art/redesign/bg/wallpaper-exercises.png");
  });
});
