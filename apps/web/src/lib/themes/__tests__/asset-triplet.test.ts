import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  AssetFamilyError,
  hasBackup,
  replaceAssetFamilyAtomic,
  restorePreviousAssetFamilyAtomic,
} from "../asset-triplet";
import { getResponsiveAssetProfile } from "../responsive-asset-profiles";

const AVATAR_FILES = [
  ".png",
  ".webp",
  ".avif",
  "-224w.webp",
  "-224w.avif",
  "-340w.webp",
  "-340w.avif",
] as const;

let rootDir: string;

async function source(width = 600, height = 500, color = "#7c3aed"): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: color,
    },
  }).png().toBuffer();
}

function publicFile(basename: string, suffix: string): string {
  return path.join(rootDir, "public", `${basename.replace(/^\//, "")}${suffix}`);
}

beforeEach(async () => {
  rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "theme-family-test-"));
  await fs.mkdir(path.join(rootDir, "public", "art"), { recursive: true });
});

afterEach(async () => {
  await fs.rm(rootDir, { recursive: true, force: true });
});

describe("responsive asset-family transaction", () => {
  it("generates canonical PNG/WebP/AVIF plus exact 224w/340w derivatives", async () => {
    const profile = getResponsiveAssetProfile("hub.avatar-lite");
    const result = await replaceAssetFamilyAtomic({
      basename: "/art/avatar",
      input: await source(),
      profile,
      rootDir,
    });

    expect(result.files).toEqual(AVATAR_FILES.map((suffix) => `/art/avatar${suffix}`));
    expect(result).toMatchObject({
      width: 499,
      height: 560,
      responsiveWidths: [224, 340],
    });
    expect(result.sourceSignature).toMatch(/^[a-f0-9]{64}$/);

    const expectedDimensions = new Map([
      [".png", [499, 560]],
      [".webp", [499, 560]],
      [".avif", [499, 560]],
      ["-224w.webp", [224, 251]],
      ["-224w.avif", [224, 251]],
      ["-340w.webp", [340, 382]],
      ["-340w.avif", [340, 382]],
    ]);
    for (const suffix of AVATAR_FILES) {
      const metadata = await sharp(publicFile("/art/avatar", suffix)).metadata();
      expect([metadata.width, metadata.height]).toEqual(expectedDimensions.get(suffix));
      expect(metadata.format).toBe(suffix.endsWith(".avif") ? "heif" : suffix.slice(suffix.lastIndexOf(".") + 1));
    }
  });

  it("rejects an undersized responsive source before mutating public files", async () => {
    const profile = getResponsiveAssetProfile("hub.avatar-lite");
    await expect(
      replaceAssetFamilyAtomic({
        basename: "/art/avatar",
        input: await source(120, 122),
        profile,
        rootDir,
      }),
    ).rejects.toMatchObject({ code: "source-too-small" } satisfies Partial<AssetFamilyError>);
    await expect(fs.readdir(path.join(rootDir, "public", "art"))).resolves.toEqual([]);
    await expect(hasBackup("/art/avatar", rootDir)).resolves.toBe(false);
  });

  it("rolls back every promoted member and preserves prior undo on a partial write", async () => {
    const profile = getResponsiveAssetProfile("hub.avatar-lite");
    const old = new Map<string, Buffer>();
    for (const [index, suffix] of AVATAR_FILES.entries()) {
      const buffer = Buffer.from(`old-${index}`);
      old.set(suffix, buffer);
      await fs.writeFile(publicFile("/art/avatar", suffix), buffer);
    }

    await expect(
      replaceAssetFamilyAtomic({
        basename: "/art/avatar",
        input: await source(),
        profile,
        rootDir,
        hooks: {
          beforePromoteMember(index) {
            if (index === 3) throw new Error("injected write failure");
          },
        },
      }),
    ).rejects.toMatchObject({ code: "write-failed" } satisfies Partial<AssetFamilyError>);

    for (const suffix of AVATAR_FILES) {
      await expect(fs.readFile(publicFile("/art/avatar", suffix))).resolves.toEqual(old.get(suffix));
    }
    await expect(hasBackup("/art/avatar", rootDir)).resolves.toBe(false);
  });

  it("rolls back public files and the prior family undo when state persistence fails", async () => {
    const profile = getResponsiveAssetProfile("hub.avatar-lite");
    const rollbackDownstream = vi.fn(async () => undefined);
    await replaceAssetFamilyAtomic({
      basename: "/art/avatar",
      input: await source(600, 500, "#2563eb"),
      profile,
      rootDir,
    });
    const before = new Map<string, Buffer>();
    for (const suffix of AVATAR_FILES) {
      before.set(suffix, await fs.readFile(publicFile("/art/avatar", suffix)));
    }

    await expect(
      replaceAssetFamilyAtomic({
        basename: "/art/avatar",
        input: await source(600, 500, "#dc2626"),
        profile,
        rootDir,
        afterPromote: async () => undefined,
        rollbackAfterPromote: rollbackDownstream,
        persistUndoState: async () => {
          throw new Error("injected metadata failure");
        },
      }),
    ).rejects.toMatchObject({ code: "metadata-failed" } satisfies Partial<AssetFamilyError>);

    for (const suffix of AVATAR_FILES) {
      await expect(fs.readFile(publicFile("/art/avatar", suffix))).resolves.toEqual(before.get(suffix));
    }
    expect(rollbackDownstream).toHaveBeenCalledOnce();
    await expect(hasBackup("/art/avatar", rootDir)).resolves.toBe(true);

    // The first successful replacement backed up an entirely absent family.
    // A failed second replacement must preserve that older one-level Undo.
    await restorePreviousAssetFamilyAtomic({ basename: "/art/avatar", rootDir });
    for (const suffix of AVATAR_FILES) {
      await expect(fs.access(publicFile("/art/avatar", suffix))).rejects.toBeDefined();
    }
  });

  it("rolls public files back when a downstream registry promotion fails", async () => {
    const profile = getResponsiveAssetProfile("hub.avatar-lite");
    const old = new Map<string, Buffer>();
    for (const [index, suffix] of AVATAR_FILES.entries()) {
      const buffer = Buffer.from(`registry-old-${index}`);
      old.set(suffix, buffer);
      await fs.writeFile(publicFile("/art/avatar", suffix), buffer);
    }

    await expect(
      replaceAssetFamilyAtomic({
        basename: "/art/avatar",
        input: await source(),
        profile,
        rootDir,
        afterPromote: async () => {
          throw new Error("injected registry failure");
        },
      }),
    ).rejects.toMatchObject({ code: "registry-failed" } satisfies Partial<AssetFamilyError>);

    for (const suffix of AVATAR_FILES) {
      await expect(fs.readFile(publicFile("/art/avatar", suffix))).resolves.toEqual(old.get(suffix));
    }
    await expect(hasBackup("/art/avatar", rootDir)).resolves.toBe(false);
  });

  it("undo restores the complete prior family including prior absences", async () => {
    const profile = getResponsiveAssetProfile("hub.avatar-lite");
    const oldPng = await source(499, 560, "#059669");
    await fs.writeFile(publicFile("/art/avatar", ".png"), oldPng);

    await replaceAssetFamilyAtomic({
      basename: "/art/avatar",
      input: await source(),
      profile,
      rootDir,
    });
    const restored = await restorePreviousAssetFamilyAtomic({
      basename: "/art/avatar",
      rootDir,
    });

    expect(restored.ok).toBe(true);
    await expect(fs.readFile(publicFile("/art/avatar", ".png"))).resolves.toEqual(oldPng);
    for (const suffix of AVATAR_FILES.slice(1)) {
      await expect(fs.access(publicFile("/art/avatar", suffix))).rejects.toBeDefined();
    }
  });

  it("a non-responsive slot writes only the canonical triplet", async () => {
    const result = await replaceAssetFamilyAtomic({
      basename: "/art/plain",
      input: await source(64, 48),
      rootDir,
    });
    expect(result.files).toEqual([
      "/art/plain.png",
      "/art/plain.webp",
      "/art/plain.avif",
    ]);
    expect(result.responsiveWidths).toEqual([]);
  });
});
