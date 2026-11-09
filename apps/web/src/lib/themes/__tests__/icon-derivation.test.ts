import { describe, it, expect, beforeAll } from "vitest";
import sharp from "sharp";
import {
  deriveBrandIcons,
  DERIVED_ICON_TARGETS,
  type DerivedIcon,
} from "../icon-derivation";

/** A stand-in master: same shape as favicon-wolf (large, square, alpha). */
async function master(): Promise<Buffer> {
  return sharp({
    create: {
      width: 1254,
      height: 1254,
      channels: 4,
      background: { r: 200, g: 40, b: 90, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}

describe("deriveBrandIcons", () => {
  let icons: DerivedIcon[];

  beforeAll(async () => {
    icons = await deriveBrandIcons(await master());
  });

  it("emits exactly the five declared targets", () => {
    expect(icons.map((i) => `${i.root}:${i.relativePath}`)).toEqual([
      "landing:public/favicon.ico",
      "landing:public/apple-icon.png",
      "web:src/app/favicon.ico",
      "web:src/app/apple-icon.png",
      "web:src/app/icon.png",
    ]);
  });

  it("keeps DERIVED_ICON_TARGETS in step with what it emits", () => {
    expect(DERIVED_ICON_TARGETS.map((t) => `${t.root}:${t.relativePath}`)).toEqual(
      icons.map((i) => `${i.root}:${i.relativePath}`),
    );
  });

  it("renders apple-icon at 180x180 in both apps", async () => {
    for (const icon of icons.filter((i) => i.relativePath.endsWith("apple-icon.png"))) {
      const meta = await sharp(icon.buffer).metadata();
      expect(meta.format).toBe("png");
      expect(meta.width).toBe(180);
      expect(meta.height).toBe(180);
    }
  });

  it("renders the web icon.png at 192x192", async () => {
    const icon = icons.find((i) => i.relativePath === "src/app/icon.png");
    const meta = await sharp(icon!.buffer).metadata();
    expect(meta.width).toBe(192);
    expect(meta.height).toBe(192);
  });

  it("packs 16, 32 and 48 into every .ico", () => {
    for (const icon of icons.filter((i) => i.relativePath.endsWith(".ico"))) {
      expect(icon.buffer.readUInt16LE(2)).toBe(1); // ICO type
      expect(icon.buffer.readUInt16LE(4)).toBe(3); // three sizes
      expect(icon.buffer.readUInt8(6 + 0 * 16)).toBe(16);
      expect(icon.buffer.readUInt8(6 + 1 * 16)).toBe(32);
      expect(icon.buffer.readUInt8(6 + 2 * 16)).toBe(48);
    }
  });

  it("ships the identical .ico to both apps — one master, no drift", () => {
    const icos = icons.filter((i) => i.relativePath.endsWith(".ico"));
    expect(icos[0].buffer.equals(icos[1].buffer)).toBe(true);
  });

  it("preserves the alpha channel so the mark is not boxed on a background", async () => {
    const apple = icons.find((i) => i.relativePath === "public/apple-icon.png");
    expect((await sharp(apple!.buffer).metadata()).hasAlpha).toBe(true);
  });

  it("letterboxes a non-square master instead of cropping the mark", async () => {
    const wide = await sharp({
      create: { width: 800, height: 400, channels: 4, background: { r: 10, g: 20, b: 30, alpha: 1 } },
    })
      .png()
      .toBuffer();
    const derived = await deriveBrandIcons(wide);
    const apple = derived.find((i) => i.relativePath === "public/apple-icon.png");
    const meta = await sharp(apple!.buffer).metadata();
    expect(meta.width).toBe(180);
    expect(meta.height).toBe(180);
  });

  it("rejects a buffer that is not an image", async () => {
    await expect(deriveBrandIcons(Buffer.from("not an image"))).rejects.toThrow();
  });
});
