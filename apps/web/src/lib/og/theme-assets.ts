import type { ThemeAssetKey } from "@/lib/themes/theme-registry";
import { resolveThemeAsset } from "@/lib/themes/resolve-theme-asset";

/** OG routes are anonymous server renders, so they intentionally resolve DEFAULT. */
export function resolveOgThemeAsset(
  requestUrl: string,
  slot: ThemeAssetKey,
): string | null {
  const asset = resolveThemeAsset(slot, "default");
  return asset ? new URL(`${asset}.png`, requestUrl).toString() : null;
}
