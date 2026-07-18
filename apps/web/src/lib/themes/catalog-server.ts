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

/** Root of statically served assets — basenames are relative to it. */
const PUBLIC_DIR = path.join(process.cwd(), "public");

/**
 * Production resolver: probes the PNG/WebP/AVIF triplet for a basename
 * and reads the real dimensions of the first file found via sharp.
 * Missing on disk → all-null (the catalog renders a "missing" state
 * rather than throwing).
 */
export const fsAssetResolver: AssetResolver = async (
  basename: string,
): Promise<ResolvedFile> => {
  const relative = basename.replace(/^\//, "");
  for (const format of TRIPLET_EXTENSIONS) {
    const abs = path.join(PUBLIC_DIR, `${relative}.${format}`);
    try {
      await fs.access(abs);
    } catch {
      continue;
    }
    try {
      const meta = await sharp(abs).metadata();
      return {
        file: `${basename}.${format}`,
        width: meta.width ?? null,
        height: meta.height ?? null,
        format,
      };
    } catch {
      // File exists but sharp can't read it — report the file, no dims.
      return { file: `${basename}.${format}`, width: null, height: null, format };
    }
  }
  return { file: null, width: null, height: null, format: null };
};

/** Build a theme's catalog against the real filesystem. Server-only. */
export function getThemeCatalog(themeId: string): Promise<ThemeCatalog | null> {
  return buildThemeCatalog(themeId, fsAssetResolver);
}
