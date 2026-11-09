/**
 * Minimal ICO container writer.
 *
 * An .ico is a directory of images, not an image format of its own: a 6-byte
 * ICONDIR, N 16-byte ICONDIRENTRY records, then the payloads. Modern icons
 * embed PNGs directly, which is what this writes — so sharp produces the
 * pixels and this only frames them.
 *
 * Exists because sharp encodes neither ICO nor its own container, and pulling
 * a dependency in for ~40 bytes of header math is not worth the supply chain.
 * Pure: buffers in, buffer out, no fs.
 */

const ICONDIR_BYTES = 6;
const ICONDIRENTRY_BYTES = 16;

export type IcoImage = {
  /** Square edge in pixels. 256 is encoded as 0 per the format. */
  size: number;
  /** Complete PNG payload for that size. */
  png: Buffer;
};

export function encodeIco(images: IcoImage[]): Buffer {
  if (images.length === 0) {
    throw new Error("encodeIco: at least one image is required");
  }

  // Windows picks the first entry that fits, so ascending order matters.
  const sorted = [...images].sort((a, b) => a.size - b.size);

  const header = Buffer.alloc(ICONDIR_BYTES);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type 1 = icon
  header.writeUInt16LE(sorted.length, 4);

  const directory = Buffer.alloc(ICONDIRENTRY_BYTES * sorted.length);
  let offset = ICONDIR_BYTES + ICONDIRENTRY_BYTES * sorted.length;

  sorted.forEach((image, index) => {
    const at = index * ICONDIRENTRY_BYTES;
    // A dimension is one byte, so 256 does not fit — the format spells it 0.
    const dimension = image.size >= 256 ? 0 : image.size;
    directory.writeUInt8(dimension, at);
    directory.writeUInt8(dimension, at + 1);
    directory.writeUInt8(0, at + 2); // palette colors — 0 for truecolor
    directory.writeUInt8(0, at + 3); // reserved
    directory.writeUInt16LE(1, at + 4); // color planes
    directory.writeUInt16LE(32, at + 6); // bits per pixel
    directory.writeUInt32LE(image.png.length, at + 8);
    directory.writeUInt32LE(offset, at + 12);
    offset += image.png.length;
  });

  return Buffer.concat([header, directory, ...sorted.map((image) => image.png)]);
}
