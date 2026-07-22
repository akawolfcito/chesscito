import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import {
  buildThemeCatalog,
  TRIPLET_EXTENSIONS,
  type AssetResolver,
  type ResolvedFile,
  type ThemeCatalog,
} from "./catalog";
import { hasBackup } from "./asset-triplet";
import { hasVariantUndo } from "./variant-undo";
import { auditResponsiveFamily } from "./responsive-asset-audit";
import { getResponsiveAssetProfile } from "./responsive-asset-profiles";
import { resolveAppRoot } from "./asset-roots";

/**
 * Production resolver: probes the PNG/WebP/AVIF triplet for a basename
 * and reads the real dimensions of the first file found via sharp.
 * Missing on disk → all-null (the catalog renders a "missing" state
 * rather than throwing).
 *
 * A basename is only meaningful together with its owning app: the same
 * `/art/...` path can exist in both `apps/web/public` and
 * `apps/landing/public`, so the slot's root decides which file is probed.
 */
export const fsAssetResolver: AssetResolver = async (
  basename: string,
  context,
): Promise<ResolvedFile> => {
  const relative = basename.replace(/^\//, "");
  const rootDir = resolveAppRoot(context?.root);
  const publicDir = path.join(rootDir, "public");
  const backup = await hasBackup(basename, rootDir);
  const profile = context ? getResponsiveAssetProfile(context.key) : null;
  const family = profile
    ? await auditResponsiveFamily(
        { basename, slots: [context!.key], profile },
        publicDir,
      )
    : null;
  // A single-file slot has exactly one legal container; probing the triplet
  // would resolve a stale sibling that nothing renders.
  const extensions = context?.format ? [context.format] : TRIPLET_EXTENSIONS;
  for (const format of extensions) {
    const abs = path.join(publicDir, `${relative}.${format}`);
    let stat: Awaited<ReturnType<typeof fs.stat>>;
    try {
      stat = await fs.stat(abs);
    } catch {
      continue;
    }
    const mtime = stat.mtimeMs;
    const bytes = stat.size;
    try {
      const meta = await sharp(abs).metadata();
      return {
        file: `${basename}.${format}`,
        width: meta.width ?? null,
        height: meta.height ?? null,
        format,
        mtime,
        bytes,
        hasBackup: backup,
        familyState: family?.state,
        familyIssues: family?.states,
      };
    } catch {
      // File exists but sharp can't read it — report the file, no dims.
      return {
        file: `${basename}.${format}`,
        width: null,
        height: null,
        format,
        mtime,
        bytes,
        hasBackup: backup,
        familyState: family?.state,
        familyIssues: family?.states,
      };
    }
  }
  return {
    file: null,
    width: null,
    height: null,
    format: null,
    mtime: null,
    bytes: null,
    hasBackup: backup,
    familyState: family?.state,
    familyIssues: family?.states,
  };
};

/** Build a theme's catalog against the real filesystem. Server-only. */
export function getThemeCatalog(themeId: string): Promise<ThemeCatalog | null> {
  return buildThemeCatalog(themeId, fsAssetResolver).then(async (catalog) => {
    if (!catalog) return null;
    await Promise.all(
      catalog.slots.map(async (slot) => {
        const [defaultUndo, proUndo] = await Promise.all([
          hasVariantUndo(themeId, slot.key, "default"),
          hasVariantUndo(themeId, slot.key, "pro"),
        ]);
        slot.defaultHasBackup ||= defaultUndo;
        slot.proHasBackup ||= proUndo;
      }),
    );
    return catalog;
  });
}
