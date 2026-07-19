export type AssetVariant =
  | { mode: "asset"; path: string }
  | { mode: "inherit" }
  | { mode: "none" };

export type DefaultAssetVariant = Exclude<AssetVariant, { mode: "inherit" }>;
export type DefaultThemeAssetValue = string | DefaultAssetVariant;
export type ProThemeAssetValue = string | AssetVariant;

export type ThemeAssetEntryLike = {
  default?: DefaultThemeAssetValue;
  pro?: ProThemeAssetValue;
};

export type ResolvedVariant =
  | { mode: "asset"; path: string }
  | { mode: "inherit" }
  | { mode: "none" };

function explicitVariant(
  value: DefaultThemeAssetValue | ProThemeAssetValue | undefined,
): AssetVariant | null {
  if (typeof value === "string") return { mode: "asset", path: value };
  return value ?? null;
}

export function resolveAssetVariant(
  entry: ThemeAssetEntryLike,
  variant: "default" | "pro",
): ResolvedVariant {
  const explicit = explicitVariant(entry[variant]);
  if (explicit) return explicit;
  return variant === "pro" ? { mode: "inherit" } : { mode: "none" };
}

export function resolveAssetPath(
  entry: ThemeAssetEntryLike,
  variant: "default" | "pro",
): string | null {
  const resolved = resolveAssetVariant(entry, variant);
  if (resolved.mode === "asset") return resolved.path;
  if (resolved.mode === "none") return null;

  const fallback = resolveAssetVariant(entry, "default");
  return fallback.mode === "asset" ? fallback.path : null;
}

export function deterministicVariantPath(
  themeId: string,
  key: string,
  variant: "default" | "pro",
): string {
  return `/art/theme-builder/${themeId}/${key.split(".").join("/")}/${variant}`;
}
