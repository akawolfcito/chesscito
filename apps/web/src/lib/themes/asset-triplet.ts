import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

/** Root of statically served assets — basenames are relative to it. */
const PUBLIC_DIR = path.join(process.cwd(), "public");

export type TripletResult = {
  files: string[];
  width: number;
  height: number;
};

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
  const relative = basename.replace(/^\//, "");
  const absNoExt = path.join(PUBLIC_DIR, relative);
  await fs.mkdir(path.dirname(absNoExt), { recursive: true });

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
