/**
 * Upload target resolution for the theme-builder asset uploader.
 *
 * SECURITY CONTRACT: the write path is derived ENTIRELY from the registry,
 * never from user input. The uploader only picks a (theme, slot, variant);
 * this resolver maps that to the basename the registry already declares.
 * There is no way for a caller to steer the write to an arbitrary path —
 * unknown theme/slot/variant are refused. Missing variant paths are created
 * under a deterministic server-owned namespace; the client never supplies a
 * destination.
 */
import {
  THEMES,
  type AppRoot,
  type SingleFileFormat,
  type ThemeAssetEntry,
  type ThemeAssetKey,
  type ThemeAssetVariant,
} from "./theme-registry";
import {
  deterministicVariantPath,
  resolveAssetVariant,
} from "./asset-variant";
import {
  getResponsiveAssetProfile,
  type ResponsiveAssetProfile,
} from "./responsive-asset-profiles";

export type UploadTarget =
  | {
      ok: true;
      basename: string;
      declaresAsset: boolean;
      responsiveProfile: ResponsiveAssetProfile | null;
      /** App whose `public/` receives the write. A basename alone is
       *  ambiguous: the same `/art/...` path exists in both apps. */
      root: AppRoot;
      /** Fixed extension for a single-file slot; null for a triplet. */
      format: SingleFileFormat | null;
      /** Set when the slot is generated from another — uploads are refused. */
      derivedFrom: ThemeAssetKey | null;
    }
  | { ok: false; reason: string };

const VALID_VARIANTS: readonly string[] = ["default", "pro"];

function isVariant(v: string): v is ThemeAssetVariant {
  return VALID_VARIANTS.includes(v);
}

/** Resolve a single slot entry + variant string to its declared basename. */
export function resolveVariantBasename(
  entry: ThemeAssetEntry,
  variant: string,
  fallback?: { themeId: string; key: string },
  responsiveProfile: ResponsiveAssetProfile | null = null,
): UploadTarget {
  if (!isVariant(variant)) {
    return { ok: false, reason: `invalid variant: ${variant}` };
  }
  const root: AppRoot = entry.root ?? "web";
  const format = entry.format ?? null;
  const derivedFrom = entry.derivedFrom ?? null;
  const resolved = resolveAssetVariant(entry, variant);
  if (resolved.mode === "asset") {
    return {
      ok: true,
      basename: resolved.path,
      declaresAsset: true,
      responsiveProfile,
      root,
      format,
      derivedFrom,
    };
  }
  if (!fallback) {
    return {
      ok: false,
      reason: "variant has no asset path and no deterministic target context",
    };
  }
  return {
    ok: true,
    basename: deterministicVariantPath(fallback.themeId, fallback.key, variant),
    declaresAsset: false,
    responsiveProfile,
    root,
    format,
    derivedFrom,
  };
}

/** Resolve (theme, slot key, variant) to the registry-declared basename. */
export function resolveUploadTarget(
  themeId: string,
  key: string,
  variant: string,
): UploadTarget {
  const theme = THEMES[themeId];
  if (!theme) return { ok: false, reason: `unknown theme: ${themeId}` };

  const entry = (theme.assets as Record<string, ThemeAssetEntry>)[key];
  if (!entry) return { ok: false, reason: `unknown slot: ${key}` };

  return resolveVariantBasename(
    entry,
    variant,
    { themeId, key },
    getResponsiveAssetProfile(key as keyof typeof theme.assets),
  );
}
