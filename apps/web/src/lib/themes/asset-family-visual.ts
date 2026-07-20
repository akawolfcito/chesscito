import { createHash } from "node:crypto";
import sharp from "sharp";

async function normalizedPixels(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .flatten({ background: "#ffffff" })
    .resize(32, 32, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer();
}

export async function normalizedVisualSignature(input: Buffer): Promise<string> {
  return createHash("sha256").update(await normalizedPixels(input)).digest("hex");
}

export async function normalizedVisualDistance(
  left: Buffer,
  right: Buffer,
): Promise<number> {
  const [a, b] = await Promise.all([
    normalizedPixels(left),
    normalizedPixels(right),
  ]);
  if (a.length !== b.length) return Number.POSITIVE_INFINITY;
  let total = 0;
  for (let i = 0; i < a.length; i += 1) {
    total += Math.abs(a[i] - b[i]);
  }
  return total / a.length;
}
