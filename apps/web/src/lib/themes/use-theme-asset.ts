"use client";

import { useActiveTheme } from "./use-active-theme";
import {
  THEMES,
  type ThemeAssetKey,
  type ThemeAssetVariant,
} from "./theme-registry";

/** Resolves a themed asset basename for the active theme.
 *
 *  Consumers receive a basename without extension and compose the
 *  AVIF/WebP/PNG triplet locally — same pattern the rest of the app
 *  uses for static assets.
 *
 *  Variant fallback: if `pro` is requested but the active theme only
 *  ships `default`, the default basename is returned. No undefined,
 *  no broken state.
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
  const theme = THEMES[themeId] ?? THEMES["candy-forest"];
  const entry = theme.assets[key];
  // PRO viewer: prefer the pro asset, else fall back to default.
  if (variant === "pro") return entry.pro ?? entry.default ?? "";
  // Default viewer: the default asset, or "" for a PRO-only slot (no free art).
  return entry.default ?? "";
}
