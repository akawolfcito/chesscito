"use client";

import type { ThemeAssetKey } from "./theme-registry";
import { useCurrentThemeAsset } from "./use-current-theme-asset";

export function themeImageSet(assetBase: string): string {
  if (!assetBase) return "none";
  return `image-set(url("${assetBase}.avif") type("image/avif"), url("${assetBase}.webp") type("image/webp"), url("${assetBase}.png") type("image/png"))`;
}

export function useThemeBackground(slot: ThemeAssetKey): string {
  return themeImageSet(useCurrentThemeAsset(slot));
}
