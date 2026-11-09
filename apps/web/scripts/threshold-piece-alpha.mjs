#!/usr/bin/env node
// Re-encode redesign piece PNGs with a hard alpha threshold so the stacked
// drop-shadow filter on .arena-treat-natural no longer projects shadow
// from invisible halo pixels (alpha 1-15) scattered around the sprite
// bounding box, which produced a rectangular "box shadow" effect instead
// of a silhouette-following one.
//
// Threshold: any pixel with alpha < 16 → alpha = 0. 16 is empirically
// invisible at sprite scale (~40-50px) but lifts the floor above the
// halo-bleed range observed in /art/redesign/pieces/*.png.
//
// Regenerates the .png + .webp + .avif triplet so all served formats
// stay in lockstep with the project's image-three-formats rule.

import sharp from "sharp";
import { readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PIECES_DIR = join(__dirname, "..", "public", "art", "redesign", "pieces");

const ALPHA_THRESHOLD = 16;
const WEBP_QUALITY = 82;
const AVIF_QUALITY = 60;

async function thresholdAlpha(file) {
  const inputPath = join(PIECES_DIR, file);
  const img = sharp(inputPath).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  let halo = 0;
  for (let i = 3; i < data.length; i += channels) {
    if (data[i] > 0 && data[i] < ALPHA_THRESHOLD) {
      data[i] = 0;
      halo++;
    }
  }

  const base = sharp(data, { raw: { width, height, channels } });

  await base.clone().png({ compressionLevel: 9 }).toFile(inputPath);
  await base.clone().webp({ quality: WEBP_QUALITY, effort: 6 }).toFile(inputPath.replace(/\.png$/, ".webp"));
  await base.clone().avif({ quality: AVIF_QUALITY, effort: 6 }).toFile(inputPath.replace(/\.png$/, ".avif"));

  return halo;
}

const files = (await readdir(PIECES_DIR)).filter((f) => f.endsWith(".png")).sort();
console.log(`Thresholding alpha (< ${ALPHA_THRESHOLD}) on ${files.length} sprites in ${PIECES_DIR}\n`);

for (const file of files) {
  const stripped = await thresholdAlpha(file);
  console.log(`  ${file.padEnd(14)} stripped ${String(stripped).padStart(4)} halo pixels`);
}

console.log("\nDone. Regenerated .png/.webp/.avif triplets.");
