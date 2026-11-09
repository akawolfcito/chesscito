/**
 * Derives every browser/OS brand icon from a single master image.
 *
 * favicon.ico and apple-icon.png are not independent art — they are crops of
 * the wolf mark. Before this module they were maintained by hand in two apps
 * and drifted: the two apple-icon.png files had already diverged while the two
 * favicon.ico files had not, and nothing reported it.
 *
 * SECURITY CONTRACT: TARGETS is a closed module constant. A caller supplies
 * the source pixels and nothing else — there is no way to steer a write at an
 * arbitrary path. The writer separately verifies each resolved destination
 * stays inside its app root.
 *
 * Pure over IO: produces buffers, writes nothing. See derived-icons-writer.ts.
 */
import sharp from "sharp";

import { encodeIco } from "./ico-encoder";
import type { AppRoot } from "./theme-registry";

/** Registry basename of the single editable master (web root, no extension). */
export const BRAND_ICON_MASTER = "/art/favicon-wolf";

/** Sizes packed into every .ico. 16/32/48 covers tabs, taskbars and shortcuts. */
const ICO_SIZES = [16, 32, 48] as const;

const APPLE_TOUCH_SIZE = 180;
const WEB_ICON_SIZE = 192;

type IconTarget = {
  root: AppRoot;
  /** Relative to the app root — NOT always under public/. The web app's icons
   *  live in src/app, where Next's file-based metadata convention puts them. */
  relativePath: string;
  content: { kind: "ico" } | { kind: "png"; size: number };
};

const TARGETS: readonly IconTarget[] = [
  { root: "landing", relativePath: "public/favicon.ico", content: { kind: "ico" } },
  {
    root: "landing",
    relativePath: "public/apple-icon.png",
    content: { kind: "png", size: APPLE_TOUCH_SIZE },
  },
  { root: "web", relativePath: "src/app/favicon.ico", content: { kind: "ico" } },
  {
    root: "web",
    relativePath: "src/app/apple-icon.png",
    content: { kind: "png", size: APPLE_TOUCH_SIZE },
  },
  {
    root: "web",
    relativePath: "src/app/icon.png",
    content: { kind: "png", size: WEB_ICON_SIZE },
  },
] as const;

/** Where the derived icons land, for callers that report without generating. */
export const DERIVED_ICON_TARGETS: readonly { root: AppRoot; relativePath: string }[] =
  TARGETS.map(({ root, relativePath }) => ({ root, relativePath }));

export type DerivedIcon = {
  root: AppRoot;
  relativePath: string;
  buffer: Buffer;
};

/** Square PNG at `size`, letterboxed on transparency so a non-square master
 *  loses no part of the mark. */
async function squarePng(source: Buffer, size: number): Promise<Buffer> {
  return sharp(source)
    .resize({
      width: size,
      height: size,
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .ensureAlpha()
    .png({ compressionLevel: 9 })
    .toBuffer();
}

export async function deriveBrandIcons(source: Buffer): Promise<DerivedIcon[]> {
  const sizes = new Set<number>([...ICO_SIZES, APPLE_TOUCH_SIZE, WEB_ICON_SIZE]);
  const pngs = new Map<number, Buffer>();
  for (const size of sizes) {
    pngs.set(size, await squarePng(source, size));
  }

  const ico = encodeIco(ICO_SIZES.map((size) => ({ size, png: pngs.get(size)! })));

  return TARGETS.map((target) => ({
    root: target.root,
    relativePath: target.relativePath,
    buffer: target.content.kind === "ico" ? ico : pngs.get(target.content.size)!,
  }));
}
