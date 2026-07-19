"use client";

import type { ThemeAssetKey } from "@/lib/themes/theme-registry";
import { useCurrentThemeAssets } from "@/lib/themes/use-current-theme-asset";
import { themeImageSet } from "@/lib/themes/use-theme-background";

export const CSS_THEME_SLOTS = [
  "shared.panel-bg",
  "shared.star",
  "exercises.badge",
  "scene.gem-pill",
  "scene.panel-pro",
  "scene.pedestal",
  "scene.stone-1",
  "scene.stone-2",
  "scene.stone-3",
  "scene.stone-4",
  "scene.stone-5",
  "scene.stone-6",
  "scene.stone-7",
  "scene.stone-8",
  "scene.stone-9",
  "scene.stone-10",
  "scene.chest-large",
  "scene.chest-small",
  "scene.banner-large",
  "scene.banner-medium",
  "scene.banner-short",
  "bg.splash-chesscito",
  "bg.wallpaper-lite",
  "bg.dock-4slots",
  "bg.menu-wall",
  "bg.path-map",
  "bg.path-map-base",
  "bg.splash-loading",
  "shop.slot-frame",
  "arena.bg-matchup",
  "hub.bg",
  "hub.btn-stone-bg",
  "hub.focus-passport-streak",
  "exercises.wall",
  "exercises.wallpaper",
  "shared.panel-frame",
  "board.tile.light",
  "board.tile.dark",
] as const satisfies readonly ThemeAssetKey[];

export function themeCssVariable(slot: ThemeAssetKey): string {
  return `--theme-${slot.replace(/\./g, "-")}`;
}

export function ThemeCssVariables(): React.JSX.Element {
  const assets = useCurrentThemeAssets(CSS_THEME_SLOTS);
  const declarations = CSS_THEME_SLOTS.map(
    (slot) => `${themeCssVariable(slot)}:${themeImageSet(assets[slot])}`,
  ).join(";");
  return (
    <style
      data-theme-css-variables
      dangerouslySetInnerHTML={{ __html: `:root{${declarations}}` }}
    />
  );
}
