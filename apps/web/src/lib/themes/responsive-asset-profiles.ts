import type { ThemeAssetKey } from "./theme-registry";

export type ResponsiveAssetProfile = Readonly<{
  widths: readonly number[];
  canonical: Readonly<{
    width: number;
    height: number;
  }>;
}>;

/**
 * Authoritative responsive metadata shared by runtime rendering and the local
 * Theme Builder. A slot absent from this map is deliberately non-responsive.
 */
export const RESPONSIVE_ASSET_PROFILES = {
  "hub.avatar-lite": {
    widths: [224, 340],
    canonical: { width: 499, height: 560 },
  },
  "brand.title": {
    widths: [288, 384],
    canonical: { width: 512, height: 249 },
  },
  "shared.welcome-gift": {
    widths: [96, 128, 160],
    canonical: { width: 512, height: 520 },
  },
} as const satisfies Partial<Record<ThemeAssetKey, ResponsiveAssetProfile>>;

export type ResponsiveThemeAssetKey = keyof typeof RESPONSIVE_ASSET_PROFILES;

export function getResponsiveAssetProfile(
  key: ThemeAssetKey,
): ResponsiveAssetProfile | null {
  return (
    RESPONSIVE_ASSET_PROFILES as Partial<
      Record<ThemeAssetKey, ResponsiveAssetProfile>
    >
  )[key] ?? null;
}

export function responsiveDerivativeHeight(
  profile: ResponsiveAssetProfile,
  width: number,
): number {
  return Math.round(
    (profile.canonical.height * width) / profile.canonical.width,
  );
}
