/**
 * Upload target resolution for the theme-builder asset uploader.
 *
 * SECURITY CONTRACT: the write path is derived ENTIRELY from the registry,
 * never from user input. The uploader only picks a (theme, slot, variant);
 * this resolver maps that to the basename the registry already declares.
 * There is no way for a caller to steer the write to an arbitrary path —
 * unknown theme/slot/variant are refused, and a `pro` upload to a slot that
 * declares no pro override is refused (you cannot mint a new variant by
 * upload; that needs a registry edit first).
 */
import {
  THEMES,
  type ThemeAssetEntry,
  type ThemeAssetVariant,
} from "./theme-registry";

export type UploadTarget =
  | { ok: true; basename: string }
  | { ok: false; reason: string };

const VALID_VARIANTS: readonly string[] = ["default", "pro"];

function isVariant(v: string): v is ThemeAssetVariant {
  return VALID_VARIANTS.includes(v);
}

/** Resolve a single slot entry + variant string to its declared basename. */
export function resolveVariantBasename(
  entry: ThemeAssetEntry,
  variant: string,
): UploadTarget {
  if (!isVariant(variant)) {
    return { ok: false, reason: `invalid variant: ${variant}` };
  }
  if (variant === "pro") {
    if (!entry.pro) {
      return {
        ok: false,
        reason: "slot ships no pro override — declare it in the registry first",
      };
    }
    return { ok: true, basename: entry.pro };
  }
  if (!entry.default) {
    return {
      ok: false,
      reason: "slot has no default asset (PRO-only) — nothing to upload here",
    };
  }
  return { ok: true, basename: entry.default };
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

  return resolveVariantBasename(entry, variant);
}
