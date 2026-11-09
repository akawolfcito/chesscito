import { resolveAssetPath } from "./asset-variant";
import {
  RESPONSIVE_ASSET_PROFILES,
  type ResponsiveThemeAssetKey,
} from "./responsive-asset-profiles";
import {
  DEFAULT_THEME_ID,
  THEMES,
  type ThemeAssetVariant,
} from "./theme-registry";
import type { ResponsiveFamilyBinding } from "./responsive-asset-audit";

export function configuredResponsiveFamilyBindings(
  themeId = DEFAULT_THEME_ID,
): ResponsiveFamilyBinding[] {
  const theme = THEMES[themeId];
  if (!theme) return [];
  const byBasename = new Map<string, ResponsiveFamilyBinding>();
  const variants: readonly ThemeAssetVariant[] = ["default", "pro"];

  for (const key of Object.keys(RESPONSIVE_ASSET_PROFILES) as ResponsiveThemeAssetKey[]) {
    const entry = theme.assets[key];
    const profile = RESPONSIVE_ASSET_PROFILES[key];
    for (const variant of variants) {
      const basename = resolveAssetPath(entry, variant);
      if (!basename) continue;
      const existing = byBasename.get(basename);
      if (existing) {
        if (!existing.slots.includes(key)) existing.slots.push(key);
      } else {
        byBasename.set(basename, { basename, slots: [key], profile });
      }
    }
  }

  return [...byBasename.values()].sort((a, b) =>
    a.basename.localeCompare(b.basename),
  );
}
