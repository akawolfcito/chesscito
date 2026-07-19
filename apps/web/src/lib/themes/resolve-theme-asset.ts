import { resolveAssetPath } from "./asset-variant";
import {
  THEMES,
  type ThemeAssetKey,
  type ThemeAssetVariant,
} from "./theme-registry";

export function resolveThemeAsset(
  key: ThemeAssetKey,
  variant: ThemeAssetVariant,
  themeId = "candy-forest",
): string | null {
  const theme = THEMES[themeId] ?? THEMES["candy-forest"];
  return resolveAssetPath(theme.assets[key], variant);
}
