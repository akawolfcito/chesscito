import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

/** Root of statically served assets — basenames are relative to it. */
const PUBLIC_DIR = path.join(process.cwd(), "public");

/** One-level undo store. Holds the triplet that a "Replace image" is about
 *  to overwrite, so it can be restored. Gitignored, mirrors the public tree,
 *  one slot per basename (a new upload overwrites the previous backup). */
const TRASH_DIR = path.join(process.cwd(), ".theme-builder-trash");

/** The three sibling extensions that make up an asset. */
const EXTENSIONS = ["png", "webp", "avif"] as const;

export type TripletResult = {
  files: string[];
  width: number;
  height: number;
};

function relOf(basename: string): string {
  return basename.replace(/^\//, "");
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** True when a one-level undo backup exists for this basename (any sibling). */
export async function hasBackup(basename: string): Promise<boolean> {
  const rel = relOf(basename);
  for (const ext of EXTENSIONS) {
    if (await exists(path.join(TRASH_DIR, `${rel}.${ext}`))) return true;
  }
  return false;
}

/** Copy the current public triplet into the trash before it is overwritten.
 *  Copies whichever siblings exist; a first-ever upload (no prior file) is a
 *  no-op, so hasBackup stays false and Undo stays disabled. */
async function backupCurrentTriplet(basename: string): Promise<void> {
  const rel = relOf(basename);
  await fs.mkdir(path.dirname(path.join(TRASH_DIR, rel)), { recursive: true });
  await Promise.all(
    EXTENSIONS.map(async (ext) => {
      const src = path.join(PUBLIC_DIR, `${rel}.${ext}`);
      if (await exists(src)) {
        await fs.copyFile(src, path.join(TRASH_DIR, `${rel}.${ext}`));
      }
    }),
  );
}

/** Restore the backed-up triplet back over the public files (one-level undo).
 *  Idempotent: the backup is left in place so the state is stable. */
export async function restorePreviousTriplet(
  basename: string,
): Promise<{ ok: boolean; restored: string[] }> {
  const rel = relOf(basename);
  const restored: string[] = [];
  for (const ext of EXTENSIONS) {
    const bak = path.join(TRASH_DIR, `${rel}.${ext}`);
    if (await exists(bak)) {
      await fs.copyFile(bak, path.join(PUBLIC_DIR, `${rel}.${ext}`));
      restored.push(`${basename}.${ext}`);
    }
  }
  return { ok: restored.length > 0, restored };
}

/**
 * Write the PNG/WebP/AVIF triplet for a registry basename from an uploaded
 * image buffer, in-process via sharp. No external binaries (cwebp/avifenc),
 * no shell — same output shape the app already consumes at render time.
 *
 * `basename` is a registry-declared path like "/art/hub/portal-…"; the
 * caller MUST resolve it through `resolveUploadTarget` so it can never be
 * attacker-controlled. Quality settings mirror scripts/gen-triplet.sh
 * closely enough for a dev tool; `pnpm art:optimize` can re-tune later.
 */
export async function writeAssetTriplet(
  basename: string,
  input: Buffer,
): Promise<TripletResult> {
  const relative = relOf(basename);
  const absNoExt = path.join(PUBLIC_DIR, relative);
  await fs.mkdir(path.dirname(absNoExt), { recursive: true });

  // One-level undo: stash the triplet we are about to overwrite.
  await backupCurrentTriplet(basename);

  // Read the source once; reuse the pipeline per format.
  const base = sharp(input);
  const meta = await base.metadata();

  // Half-A optimization — matches scripts/optimize-assets.sh, in-process:
  //  • PNG: palette quantization (libimagequant, bundled in sharp) ≈ pngquant,
  //    metadata stripped by default. Lossy but visually near-identical for the
  //    game's illustration art. Dimensions are NOT touched (that is Half B).
  //  • WebP/AVIF: tuned quality siblings the browser picks over the PNG.
  const png = await sharp(input)
    .png({ palette: true, quality: 80, effort: 10, compressionLevel: 9 })
    .toBuffer();
  const webp = await sharp(input).webp({ quality: 80, effort: 6 }).toBuffer();
  const avif = await sharp(input).avif({ quality: 50, effort: 4 }).toBuffer();

  await Promise.all([
    fs.writeFile(`${absNoExt}.png`, png),
    fs.writeFile(`${absNoExt}.webp`, webp),
    fs.writeFile(`${absNoExt}.avif`, avif),
  ]);

  return {
    files: [`${basename}.png`, `${basename}.webp`, `${basename}.avif`],
    width: meta.width ?? 0,
    height: meta.height ?? 0,
  };
}
