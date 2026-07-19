import { preload } from "react-dom";
import { resolveThemeAsset } from "@/lib/themes/resolve-theme-asset";

/**
 * Server layout for /arena. The page itself is a (fragile) client
 * component — see memory `arena-play-timer-fragility` — so resource
 * hints live here, out of its render path.
 *
 * LCP on /arena mobile is `main.arena-scaffold`, whose background is
 * bg-ch via `--playhub-game-bg` (globals.css). CSS-gated discovery
 * meant the browser only fetched it after parsing the render-blocking
 * stylesheet (~1s of LCP Load Delay on Slow-4G). AVIF-only preload for
 * the same MiniPay-Chromium reason as /hub (see hub/page.tsx).
 */
export default function ArenaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const wallpaper = resolveThemeAsset("exercises.wallpaper", "default");
  if (wallpaper) preload(`${wallpaper}.avif`, { as: "image", type: "image/avif", fetchPriority: "high" });

  return children;
}
