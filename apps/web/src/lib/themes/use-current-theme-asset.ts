"use client";

import type { ThemeAssetKey } from "./theme-registry";
import { useThemeAsset } from "./use-theme-asset";
import { useActiveTheme } from "./use-active-theme";
import { resolveThemeAsset } from "./resolve-theme-asset";
import { useThemeVariant } from "./theme-variant-provider";

export function useCurrentThemeAsset(key: ThemeAssetKey): string {
  const variant = useThemeVariant();
  return useThemeAsset(key, variant);
}

export function useCurrentThemeAssets<const Key extends ThemeAssetKey>(
  keys: readonly Key[],
): Record<Key, string> {
  const variant = useThemeVariant();
  const themeId = useActiveTheme();
  return Object.fromEntries(
    keys.map((key) => [key, resolveThemeAsset(key, variant, themeId) ?? ""]),
  ) as Record<Key, string>;
}
