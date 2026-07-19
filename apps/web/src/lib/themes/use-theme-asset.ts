"use client";

import { useActiveTheme } from "./use-active-theme";
import {
  type ThemeAssetKey,
  type ThemeAssetVariant,
} from "./theme-registry";
import { resolveThemeAsset } from "./resolve-theme-asset";

/** Resolves a themed asset basename for the active theme.
 *
 *  Consumers receive a basename without extension and compose the
 *  AVIF/WebP/PNG triplet locally — same pattern the rest of the app
 *  uses for static assets.
 *
 *  Variant fallback: an absent/explicit-inherit PRO value resolves DEFAULT;
 *  an explicit none resolves to an empty path so consumers can omit <img>.
 *
 *  Example:
 *  ```ts
 *  const isPro = useIsProActive();
 *  const portalBase = useThemeAsset("hub.portal", isPro ? "pro" : "default");
 *  ```
 */
export function useThemeAsset(
  key: ThemeAssetKey,
  variant: ThemeAssetVariant = "default",
): string {
  const themeId = useActiveTheme();
  return resolveThemeAsset(key, variant, themeId) ?? "";
}
