# Theme Builder — OG image + derived brand icons — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the landing OG image, apple-icon and favicon.ico manageable from `/dev/theme-builder`, with `/art/favicon-wolf` as the single master that regenerates all five brand icons across both apps.

**Architecture:** Two new optional fields on `ThemeAssetEntry` — `format` (a slot that is one file with a fixed extension instead of a PNG/WebP/AVIF triplet) and `derivedFrom` (a read-only slot generated from another). A dependency-free ICO encoder plus a sharp-based derivation module produce the five icons; a script and the Replace handler both call it.

**Tech Stack:** TypeScript, Next.js 14 App Router, sharp (already pinned), vitest, tsx for scripts.

Spec: `docs/superpowers/specs/2026-07-22-theme-builder-brand-icons-design.md`

## Global Constraints

- **No new dependencies.** The ICO encoder is written by hand. `sharp` cannot encode ICO and cannot decode it either.
- **Command hygiene (CLAUDE.md).** Never prefix with `cd`. Use `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web ...` and `git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito ...`. One command per tool call. No heredocs — create files with the Write tool.
- **Git staging.** Explicit paths in `git add`. Never globs or brackets — zsh eats them.
- **Commit signature.** Every commit message ends with a line containing `Wolfcito 🐾 @akawolfcito`. No backticks anywhere in a commit message — zsh eats the words.
- **Code, types and comments in English.** UI copy in English.
- **Existing slots must not change behavior.** Every new field is optional; absent means the historic triplet path. ~165 slots depend on that.
- **Exact dependency pins.** If `package.json` is touched, no `^` or `~`.
- **Test suite baseline:** 5003 passing / 420 files (2026-07-12). Report the pass count in commit messages.
- **A green vitest run can still exit non-zero** via `Unhandled Errors`. Read the tail of the log, not just the counts.

---

### Task 1: ICO encoder

A `.ico` is a container: `ICONDIR` (6 bytes) + N × `ICONDIRENTRY` (16 bytes) + the PNG payloads concatenated. Sharp makes the PNGs; this module assembles the container. Pure — buffers in, buffer out, no fs.

**Files:**
- Create: `apps/web/src/lib/themes/ico-encoder.ts`
- Test: `apps/web/src/lib/themes/__tests__/ico-encoder.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `export type IcoImage = { size: number; png: Buffer }` and `export function encodeIco(images: IcoImage[]): Buffer`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/themes/__tests__/ico-encoder.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { encodeIco } from "../ico-encoder";

/** Payload stand-ins — encodeIco never decodes them, it only frames them. */
const png = (byte: number, length: number): Buffer => Buffer.alloc(length, byte);

describe("encodeIco", () => {
  it("writes an ICONDIR header with type 1 and the image count", () => {
    const ico = encodeIco([{ size: 16, png: png(0xaa, 10) }]);
    expect(ico.readUInt16LE(0)).toBe(0); // reserved
    expect(ico.readUInt16LE(2)).toBe(1); // type: icon
    expect(ico.readUInt16LE(4)).toBe(1); // count
  });

  it("writes one 16-byte directory entry per image, sorted ascending by size", () => {
    const ico = encodeIco([
      { size: 48, png: png(0x03, 30) },
      { size: 16, png: png(0x01, 10) },
      { size: 32, png: png(0x02, 20) },
    ]);
    expect(ico.readUInt16LE(4)).toBe(3);
    expect(ico.readUInt8(6 + 0 * 16)).toBe(16);
    expect(ico.readUInt8(6 + 1 * 16)).toBe(32);
    expect(ico.readUInt8(6 + 2 * 16)).toBe(48);
  });

  it("points each entry at its payload with a cumulative offset", () => {
    const ico = encodeIco([
      { size: 16, png: png(0x01, 10) },
      { size: 32, png: png(0x02, 20) },
    ]);
    const headerBytes = 6 + 2 * 16;
    expect(ico.readUInt32LE(6 + 8)).toBe(10); // bytesInRes, first
    expect(ico.readUInt32LE(6 + 12)).toBe(headerBytes); // imageOffset, first
    expect(ico.readUInt32LE(6 + 16 + 8)).toBe(20);
    expect(ico.readUInt32LE(6 + 16 + 12)).toBe(headerBytes + 10);
    expect(ico.length).toBe(headerBytes + 30);
  });

  it("recovers each payload byte-for-byte at its declared offset", () => {
    const first = png(0x01, 10);
    const second = png(0x02, 20);
    const ico = encodeIco([
      { size: 16, png: first },
      { size: 32, png: second },
    ]);
    const offset = ico.readUInt32LE(6 + 16 + 12);
    const length = ico.readUInt32LE(6 + 16 + 8);
    expect(ico.subarray(offset, offset + length).equals(second)).toBe(true);
  });

  it("declares 1 color plane and 32 bits per pixel", () => {
    const ico = encodeIco([{ size: 32, png: png(0x01, 8) }]);
    expect(ico.readUInt16LE(6 + 4)).toBe(1);
    expect(ico.readUInt16LE(6 + 6)).toBe(32);
  });

  it("encodes a 256px image as 0, the format's escape for 256", () => {
    const ico = encodeIco([{ size: 256, png: png(0x01, 8) }]);
    expect(ico.readUInt8(6)).toBe(0);
    expect(ico.readUInt8(7)).toBe(0);
  });

  it("refuses an empty image list rather than emitting a header-only file", () => {
    expect(() => encodeIco([])).toThrow(/at least one image/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec vitest run src/lib/themes/__tests__/ico-encoder.test.ts`

Expected: FAIL — `Failed to resolve import "../ico-encoder"`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/lib/themes/ico-encoder.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec vitest run src/lib/themes/__tests__/ico-encoder.test.ts`

Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito add apps/web/src/lib/themes/ico-encoder.ts apps/web/src/lib/themes/__tests__/ico-encoder.test.ts
```

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito commit -m "feat(themes): add a dependency-free ICO container encoder

sharp encodes no ICO, so the container header is assembled by hand:
ICONDIR + one ICONDIRENTRY per size + the PNG payloads. Pure module,
7 tests passing.

Wolfcito 🐾 @akawolfcito"
```

---

### Task 2: Brand icon derivation

Turns one master buffer into the five brand icons. The destination table is a module constant — no caller supplies a path.

**Files:**
- Create: `apps/web/src/lib/themes/icon-derivation.ts`
- Test: `apps/web/src/lib/themes/__tests__/icon-derivation.test.ts`

**Interfaces:**
- Consumes: `encodeIco(images: IcoImage[]): Buffer` from Task 1; `AppRoot` from `./theme-registry`.
- Produces:
  - `export const BRAND_ICON_MASTER = "/art/favicon-wolf"` (basename, web root)
  - `export type DerivedIcon = { root: AppRoot; relativePath: string; buffer: Buffer }`
  - `export const DERIVED_ICON_TARGETS: readonly { root: AppRoot; relativePath: string }[]`
  - `export async function deriveBrandIcons(source: Buffer): Promise<DerivedIcon[]>`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/themes/__tests__/icon-derivation.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec vitest run src/lib/themes/__tests__/icon-derivation.test.ts`

Expected: FAIL — `Failed to resolve import "../icon-derivation"`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/lib/themes/icon-derivation.ts`:

```ts
/**
 * Derives every browser/OS brand icon from a single master image.
 *
 * favicon.ico and apple-icon.png are not independent art — they are crops of
 * the wolf mark. Before this module they were maintained by hand in two apps
 * and drifted: the two apple-icon.png files had already diverged while the two
 * favicon.ico files had not, and nothing reported it.
 *
 * SECURITY CONTRACT: DERIVED_ICON_TARGETS is a closed module constant. A
 * caller supplies the source pixels and nothing else — there is no way to
 * steer a write at an arbitrary path. The writer separately verifies each
 * resolved destination stays inside its app root.
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
  { root: "landing", relativePath: "public/apple-icon.png", content: { kind: "png", size: APPLE_TOUCH_SIZE } },
  { root: "web", relativePath: "src/app/favicon.ico", content: { kind: "ico" } },
  { root: "web", relativePath: "src/app/apple-icon.png", content: { kind: "png", size: APPLE_TOUCH_SIZE } },
  { root: "web", relativePath: "src/app/icon.png", content: { kind: "png", size: WEB_ICON_SIZE } },
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec vitest run src/lib/themes/__tests__/icon-derivation.test.ts`

Expected: PASS — 9 tests.

- [ ] **Step 5: Commit**

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito add apps/web/src/lib/themes/icon-derivation.ts apps/web/src/lib/themes/__tests__/icon-derivation.test.ts
```

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito commit -m "feat(themes): derive the five brand icons from one master

favicon-wolf now generates favicon.ico and apple-icon.png for both
apps plus the web icon.png. Destination table is a module constant,
so no caller can steer a write. 9 tests passing.

Wolfcito 🐾 @akawolfcito"
```

---

### Task 3: Derived icon writer

Writes what Task 2 produced, atomically, and refuses any destination that escapes its app root.

**Files:**
- Create: `apps/web/src/lib/themes/derived-icons-writer.ts`
- Test: `apps/web/src/lib/themes/__tests__/derived-icons-writer.test.ts`

**Interfaces:**
- Consumes: `DerivedIcon` from Task 2; `resolveAppRoot(root: AppRoot | undefined): string` from `./asset-roots`.
- Produces:
  - `export type DerivedIconWriteResult = { ok: true; files: string[] } | { ok: false; error: string }`
  - `export async function writeDerivedIcons(icons: DerivedIcon[], options?: { rootResolver?: (root: AppRoot) => string }): Promise<DerivedIconWriteResult>`
  - `export async function readDerivedIconOnDisk(icon: DerivedIcon, rootResolver?: (root: AppRoot) => string): Promise<Buffer | null>`

The `rootResolver` override exists so tests write into a tmpdir instead of the repo. Production callers omit it.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/themes/__tests__/derived-icons-writer.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  writeDerivedIcons,
  readDerivedIconOnDisk,
} from "../derived-icons-writer";
import type { DerivedIcon } from "../icon-derivation";
import type { AppRoot } from "../theme-registry";

let sandbox: string;
const resolver = (root: AppRoot) => path.join(sandbox, root);

beforeEach(async () => {
  sandbox = await fs.mkdtemp(path.join(os.tmpdir(), "derived-icons-"));
});

afterEach(async () => {
  await fs.rm(sandbox, { recursive: true, force: true });
});

const icon = (relativePath: string, byte = 0x7f): DerivedIcon => ({
  root: "web",
  relativePath,
  buffer: Buffer.alloc(8, byte),
});

describe("writeDerivedIcons", () => {
  it("creates missing directories and writes each buffer", async () => {
    const result = await writeDerivedIcons([icon("src/app/favicon.ico")], {
      rootResolver: resolver,
    });
    expect(result.ok).toBe(true);
    const written = await fs.readFile(path.join(sandbox, "web/src/app/favicon.ico"));
    expect(written.equals(Buffer.alloc(8, 0x7f))).toBe(true);
  });

  it("reports every file it wrote, root-prefixed", async () => {
    const result = await writeDerivedIcons(
      [icon("src/app/favicon.ico"), icon("src/app/icon.png")],
      { rootResolver: resolver },
    );
    expect(result).toEqual({
      ok: true,
      files: ["web/src/app/favicon.ico", "web/src/app/icon.png"],
    });
  });

  it("overwrites an existing file", async () => {
    await fs.mkdir(path.join(sandbox, "web/src/app"), { recursive: true });
    await fs.writeFile(path.join(sandbox, "web/src/app/icon.png"), Buffer.alloc(4, 0x01));
    await writeDerivedIcons([icon("src/app/icon.png", 0x02)], { rootResolver: resolver });
    const written = await fs.readFile(path.join(sandbox, "web/src/app/icon.png"));
    expect(written.equals(Buffer.alloc(8, 0x02))).toBe(true);
  });

  it("leaves no .tmp files behind", async () => {
    await writeDerivedIcons([icon("src/app/icon.png")], { rootResolver: resolver });
    const names = await fs.readdir(path.join(sandbox, "web/src/app"));
    expect(names).toEqual(["icon.png"]);
  });

  it("refuses a destination that escapes the app root", async () => {
    const result = await writeDerivedIcons([icon("../../../etc/passwd")], {
      rootResolver: resolver,
    });
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/outside its app root/i),
    });
  });

  it("writes nothing at all when one destination is rejected", async () => {
    await writeDerivedIcons([icon("src/app/icon.png"), icon("../escape.png")], {
      rootResolver: resolver,
    });
    await expect(fs.access(path.join(sandbox, "web/src/app/icon.png"))).rejects.toThrow();
  });

  it("reports the failure instead of throwing when the write itself fails", async () => {
    // A regular file sits where a directory would have to be created.
    await fs.mkdir(path.join(sandbox, "web/src/app"), { recursive: true });
    await fs.writeFile(path.join(sandbox, "web/src/app/icon.png"), "x");
    const result = await writeDerivedIcons([icon("src/app/icon.png/nested.png")], {
      rootResolver: resolver,
    });
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/could not write/i),
    });
  });
});

describe("readDerivedIconOnDisk", () => {
  it("returns the bytes currently on disk", async () => {
    await writeDerivedIcons([icon("src/app/icon.png")], { rootResolver: resolver });
    const bytes = await readDerivedIconOnDisk(icon("src/app/icon.png"), resolver);
    expect(bytes?.equals(Buffer.alloc(8, 0x7f))).toBe(true);
  });

  it("returns null when the file does not exist", async () => {
    expect(await readDerivedIconOnDisk(icon("src/app/missing.png"), resolver)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec vitest run src/lib/themes/__tests__/derived-icons-writer.test.ts`

Expected: FAIL — `Failed to resolve import "../derived-icons-writer"`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/lib/themes/derived-icons-writer.ts`:

```ts
/**
 * Writes derived brand icons to disk.
 *
 * Split from icon-derivation.ts so the derivation stays pure and testable
 * without a filesystem. This half owns the two things that touch the world:
 * path containment and atomic replacement.
 *
 * Containment matters more here than for the rest of the theme builder,
 * because these destinations are the first ones that live OUTSIDE public/.
 * Every resolved path is checked against its app root before any write.
 */
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { resolveAppRoot } from "./asset-roots";
import type { DerivedIcon } from "./icon-derivation";
import type { AppRoot } from "./theme-registry";

export type DerivedIconWriteResult =
  | { ok: true; files: string[] }
  | { ok: false; error: string };

type RootResolver = (root: AppRoot) => string;

const defaultResolver: RootResolver = (root) => resolveAppRoot(root);

/** Absolute destination, or null when it would escape the app root. */
function resolveDestination(icon: DerivedIcon, resolver: RootResolver): string | null {
  const rootDir = path.resolve(resolver(icon.root));
  const absolute = path.resolve(rootDir, icon.relativePath);
  const contained = absolute === rootDir || absolute.startsWith(rootDir + path.sep);
  return contained ? absolute : null;
}

/** Write via a sibling temp file + rename, so a reader never sees a partial
 *  icon and a crash mid-write leaves the previous file intact. */
async function writeAtomic(destination: string, bytes: Buffer): Promise<void> {
  await fs.mkdir(path.dirname(destination), { recursive: true });
  const temp = `${destination}.derived-${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temp, bytes);
    await fs.rename(temp, destination);
  } catch (error) {
    await fs.rm(temp, { force: true });
    throw error;
  }
}

export async function writeDerivedIcons(
  icons: DerivedIcon[],
  options?: { rootResolver?: RootResolver },
): Promise<DerivedIconWriteResult> {
  const resolver = options?.rootResolver ?? defaultResolver;

  // Resolve every destination BEFORE writing any of them: a rejected path
  // must not leave half the icon set updated.
  const destinations: { icon: DerivedIcon; absolute: string }[] = [];
  for (const icon of icons) {
    const absolute = resolveDestination(icon, resolver);
    if (!absolute) {
      return {
        ok: false,
        error: `refusing to write ${icon.relativePath} — resolves outside its app root`,
      };
    }
    destinations.push({ icon, absolute });
  }

  const files: string[] = [];
  for (const { icon, absolute } of destinations) {
    try {
      await writeAtomic(absolute, icon.buffer);
    } catch (error) {
      return {
        ok: false,
        error: `could not write ${icon.root}/${icon.relativePath}: ${String(error)}`,
      };
    }
    files.push(`${icon.root}/${icon.relativePath}`);
  }

  return { ok: true, files };
}

/** Current bytes of a derived icon, or null when absent. Drift detection. */
export async function readDerivedIconOnDisk(
  icon: DerivedIcon,
  rootResolver: RootResolver = defaultResolver,
): Promise<Buffer | null> {
  const absolute = resolveDestination(icon, rootResolver);
  if (!absolute) return null;
  try {
    return await fs.readFile(absolute);
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec vitest run src/lib/themes/__tests__/derived-icons-writer.test.ts`

Expected: PASS — 9 tests.

- [ ] **Step 5: Commit**

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito add apps/web/src/lib/themes/derived-icons-writer.ts apps/web/src/lib/themes/__tests__/derived-icons-writer.test.ts
```

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito commit -m "feat(themes): write derived icons atomically, inside their app root

These are the first theme-builder destinations outside public/, so
every resolved path is checked for containment before any write and a
rejected path aborts the whole set. 9 tests passing.

Wolfcito 🐾 @akawolfcito"
```

---

### Task 4: The generation script

Standalone regeneration plus a CI-friendly drift check, mirroring `sync-landing-shared-art.ts`.

**Files:**
- Create: `apps/web/scripts/generate-brand-icons.ts`
- Modify: `apps/web/package.json:23-28` (scripts block, next to the other `art:` entries)
- Test: `apps/web/src/lib/themes/__tests__/brand-icon-drift.test.ts`

**Interfaces:**
- Consumes: `deriveBrandIcons`, `BRAND_ICON_MASTER` (Task 2); `writeDerivedIcons`, `readDerivedIconOnDisk` (Task 3); `resolveAppRoot` from `./asset-roots`.
- Produces: in `apps/web/src/lib/themes/icon-drift.ts`,
  `export async function findBrandIconDrift(icons: DerivedIcon[], rootResolver?: (root: AppRoot) => string): Promise<string[]>`
  — returns the root-prefixed paths whose on-disk bytes differ from the derived ones. The resolver defaults to `resolveAppRoot`; tests pass a tmpdir one. The script consumes it; the test covers it.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/themes/__tests__/brand-icon-drift.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { findBrandIconDrift } from "../icon-drift";
import { writeDerivedIcons } from "../derived-icons-writer";
import type { DerivedIcon } from "../icon-derivation";
import type { AppRoot } from "../theme-registry";

let sandbox: string;
const resolver = (root: AppRoot) => path.join(sandbox, root);

beforeEach(async () => {
  sandbox = await fs.mkdtemp(path.join(os.tmpdir(), "icon-drift-"));
});

afterEach(async () => {
  await fs.rm(sandbox, { recursive: true, force: true });
});

const icons: DerivedIcon[] = [
  { root: "web", relativePath: "src/app/icon.png", buffer: Buffer.alloc(8, 0x01) },
  { root: "landing", relativePath: "public/favicon.ico", buffer: Buffer.alloc(8, 0x02) },
];

describe("findBrandIconDrift", () => {
  it("reports every target as drifted when nothing is on disk", async () => {
    expect(await findBrandIconDrift(icons, resolver)).toEqual([
      "web/src/app/icon.png",
      "landing/public/favicon.ico",
    ]);
  });

  it("reports nothing when disk matches the derived bytes", async () => {
    await writeDerivedIcons(icons, { rootResolver: resolver });
    expect(await findBrandIconDrift(icons, resolver)).toEqual([]);
  });

  it("reports only the file whose bytes differ", async () => {
    await writeDerivedIcons(icons, { rootResolver: resolver });
    await fs.writeFile(
      path.join(sandbox, "landing/public/favicon.ico"),
      Buffer.alloc(8, 0xff),
    );
    expect(await findBrandIconDrift(icons, resolver)).toEqual([
      "landing/public/favicon.ico",
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec vitest run src/lib/themes/__tests__/brand-icon-drift.test.ts`

Expected: FAIL — `Failed to resolve import "../icon-drift"`.

- [ ] **Step 3: Write the drift module**

Create `apps/web/src/lib/themes/icon-drift.ts`:

```ts
/**
 * Drift detection for derived brand icons.
 *
 * Shared by the generation script (--check mode) and anything else that wants
 * to know whether the icons on disk still match the master without writing.
 */
import { readDerivedIconOnDisk } from "./derived-icons-writer";
import { resolveAppRoot } from "./asset-roots";
import type { DerivedIcon } from "./icon-derivation";
import type { AppRoot } from "./theme-registry";

/** Root-prefixed paths whose bytes on disk differ from the derived ones.
 *  A missing file counts as drifted. */
export async function findBrandIconDrift(
  icons: DerivedIcon[],
  rootResolver: (root: AppRoot) => string = (root) => resolveAppRoot(root),
): Promise<string[]> {
  const drifted: string[] = [];
  for (const icon of icons) {
    const current = await readDerivedIconOnDisk(icon, rootResolver);
    if (!current || !current.equals(icon.buffer)) {
      drifted.push(`${icon.root}/${icon.relativePath}`);
    }
  }
  return drifted;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec vitest run src/lib/themes/__tests__/brand-icon-drift.test.ts`

Expected: PASS — 3 tests.

- [ ] **Step 5: Write the script**

Create `apps/web/scripts/generate-brand-icons.ts`:

```ts
/**
 * Regenerate every brand icon from the wolf master.
 *
 *   pnpm icons:generate          # write what drifted
 *   pnpm icons:generate --check  # report drift, exit 1, write nothing
 *
 * The master is apps/web/public/art/favicon-wolf.png. Five files come out of
 * it: favicon.ico and apple-icon.png for both apps, plus the web icon.png.
 * Before this existed the two apple-icon.png files had already diverged.
 *
 * --check is the CI-friendly form. Note it compares bytes, so a sharp or
 * libvips upgrade can report drift on untouched art — regenerating and
 * committing is the correct response in that case.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

import {
  BRAND_ICON_MASTER,
  deriveBrandIcons,
} from "../src/lib/themes/icon-derivation";
import { writeDerivedIcons } from "../src/lib/themes/derived-icons-writer";
import { findBrandIconDrift } from "../src/lib/themes/icon-drift";
import { resolveAppRoot } from "../src/lib/themes/asset-roots";

const CHECK_MODE = process.argv.includes("--check");

const MASTER_FILE = path.join(
  resolveAppRoot("web"),
  "public",
  `${BRAND_ICON_MASTER.replace(/^\//, "")}.png`,
);

async function main(): Promise<void> {
  let source: Buffer;
  try {
    source = await fs.readFile(MASTER_FILE);
  } catch {
    console.error(
      JSON.stringify({ error: "master not found", master: MASTER_FILE }, null, 2),
    );
    process.exitCode = 1;
    return;
  }

  const icons = await deriveBrandIcons(source);
  const drifted = await findBrandIconDrift(icons);

  if (CHECK_MODE) {
    console.log(
      JSON.stringify(
        { mode: "check", master: BRAND_ICON_MASTER, targets: icons.length, drifted },
        null,
        2,
      ),
    );
    if (drifted.length > 0) process.exitCode = 1;
    return;
  }

  const written = await writeDerivedIcons(icons);
  console.log(
    JSON.stringify(
      {
        mode: "generate",
        master: BRAND_ICON_MASTER,
        drifted,
        ...(written.ok ? { written: written.files } : { error: written.error }),
      },
      null,
      2,
    ),
  );
  if (!written.ok) process.exitCode = 1;
}

void main();
```

- [ ] **Step 6: Register the npm scripts**

In `apps/web/package.json`, immediately after the `art:sync-landing:check` line, add:

```json
    "icons:generate": "tsx scripts/generate-brand-icons.ts",
    "icons:generate:check": "tsx scripts/generate-brand-icons.ts --check",
```

- [ ] **Step 7: Run the check against the real repo**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web icons:generate:check`

Expected: exit 1, with `drifted` listing all five files — the current icons were made by hand, so none match freshly derived bytes. That is the drift this task exists to expose.

- [ ] **Step 8: Regenerate and inspect the result**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web icons:generate`

Expected: `"mode": "generate"` with all five paths under `written`.

**STOP and show the user the regenerated `apps/landing/public/apple-icon.png` and `apps/web/src/app/icon.png` before committing.** These are the real brand icons — if the derived crop looks worse than the hand-made ones, that is a design decision, not a test failure.

- [ ] **Step 9: Verify the check is now clean**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web icons:generate:check`

Expected: exit 0, `"drifted": []`.

- [ ] **Step 10: Commit**

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito add apps/web/scripts/generate-brand-icons.ts apps/web/src/lib/themes/icon-drift.ts apps/web/src/lib/themes/__tests__/brand-icon-drift.test.ts apps/web/package.json apps/landing/public/favicon.ico apps/landing/public/apple-icon.png apps/web/src/app/favicon.ico apps/web/src/app/apple-icon.png apps/web/src/app/icon.png
```

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito commit -m "feat(themes): add icons:generate and regenerate every brand icon

One command rebuilds all five icons from favicon-wolf, and --check
fails CI on drift. The regenerated files replace the hand-made ones,
which had already diverged between the two apps. 3 tests passing.

Wolfcito 🐾 @akawolfcito"
```

---

### Task 5: `format` and `derivedFrom` in the registry types and the catalog

Read side only. Nothing writes a single-file slot yet.

**Files:**
- Modify: `apps/web/src/lib/themes/theme-registry.ts` (the `ThemeAssetEntry` type)
- Modify: `apps/web/src/lib/themes/catalog.ts:24-26,50-57,62-82,104-143`
- Modify: `apps/web/src/lib/themes/catalog-server.ts:28-88`
- Modify: `apps/web/src/lib/themes/upload-target.ts:27-37,45-99`
- Test: `apps/web/src/lib/themes/__tests__/catalog.test.ts` (append)

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `export type SingleFileFormat = "jpg" | "ico" | "png"` (from `theme-registry`)
  - `ThemeAssetEntry.format?: SingleFileFormat`
  - `ThemeAssetEntry.derivedFrom?: ThemeAssetKey`
  - `AssetFormat` in `catalog.ts` widens to `"png" | "webp" | "avif" | "jpg" | "ico"`
  - `AssetResolver` context gains `format?: SingleFileFormat`
  - `SlotCatalogEntry.format: SingleFileFormat | null` and `SlotCatalogEntry.derivedFrom: ThemeAssetKey | null`
  - `UploadTarget` (ok branch) gains `format: SingleFileFormat | null` and `derivedFrom: ThemeAssetKey | null`

- [ ] **Step 1: Write the failing test**

Append to `apps/web/src/lib/themes/__tests__/catalog.test.ts`:

```ts
describe("single-file and derived slots", () => {
  /** A stub theme is not possible here — THEMES is the real registry — so
   *  these assert against the slots Task 8 registers. Until then they fail,
   *  which is the point. */
  it("reports the declared format for a single-file slot", async () => {
    const catalog = await buildThemeCatalog("candy-forest", okResolver);
    const og = catalog?.slots.find((s) => s.key === "landing.og-image");
    expect(og?.format).toBe("jpg");
  });

  it("leaves format null for a normal triplet slot", async () => {
    const catalog = await buildThemeCatalog("candy-forest", okResolver);
    const portal = catalog?.slots.find((s) => s.key === "hub.portal");
    expect(portal?.format).toBeNull();
  });

  it("passes the format down to the resolver so it probes one extension", async () => {
    const seen: { basename: string; format?: string }[] = [];
    const spy: AssetResolver = async (basename, context) => {
      seen.push({ basename, format: context?.format });
      return {
        file: `${basename}.jpg`,
        width: 1200,
        height: 630,
        format: "jpg" as const,
        mtime: 1,
        hasBackup: false,
      };
    };
    await buildThemeCatalog("candy-forest", spy);
    const og = seen.find((s) => s.basename === "/og/chesscito-landing");
    expect(og?.format).toBe("jpg");
  });

  it("marks a derived slot with the key it comes from", async () => {
    const catalog = await buildThemeCatalog("candy-forest", okResolver);
    const favicon = catalog?.slots.find((s) => s.key === "brand.favicon-ico");
    expect(favicon?.derivedFrom).toBe("brand.favicon");
  });

  it("leaves derivedFrom null for an independently editable slot", async () => {
    const catalog = await buildThemeCatalog("candy-forest", okResolver);
    const og = catalog?.slots.find((s) => s.key === "landing.og-image");
    expect(og?.derivedFrom).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec vitest run src/lib/themes/__tests__/catalog.test.ts`

Expected: FAIL — the new slots do not exist yet, so `og` is `undefined`. The five new tests fail; the existing ones still pass.

- [ ] **Step 3: Add the registry fields**

In `apps/web/src/lib/themes/theme-registry.ts`, above the `ThemeAssetEntry` type, add:

```ts
/** Extensions a single-file slot may declare. A slot without `format` is a
 *  PNG/WebP/AVIF triplet — the shape ~165 slots have. */
export type SingleFileFormat = "jpg" | "ico" | "png";
```

Then add these two fields to `ThemeAssetEntry` (keep the existing ones untouched):

```ts
  /** This slot is ONE file with this fixed extension, not a triplet. Set it
   *  for assets that must keep a specific container: an Open Graph .jpg, a
   *  browser .ico. Absent = the historic triplet. */
  format?: SingleFileFormat;
  /** This slot is generated from another slot and is not editable on its own.
   *  The catalog renders it read-only and the upload API refuses it. */
  derivedFrom?: ThemeAssetKey;
```

- [ ] **Step 4: Widen the catalog types and thread `format` through**

In `apps/web/src/lib/themes/catalog.ts`:

Replace the `AssetFormat` declaration (line 26) with:

```ts
export type AssetFormat = (typeof TRIPLET_EXTENSIONS)[number] | SingleFileFormat;
```

and add `SingleFileFormat` to the import from `./theme-registry`.

Add `format` to the resolver context (the `AssetResolver` type):

```ts
export type AssetResolver = (
  basename: string,
  context?: {
    key: ThemeAssetKey;
    variant: ThemeAssetVariant;
    root: AppRoot;
    /** Present when the slot is a single file — probe only this extension. */
    format?: SingleFileFormat;
  },
) => Promise<ResolvedFile>;
```

Add both fields to `SlotCatalogEntry`:

```ts
  /** Fixed extension when this slot is one file; null for a triplet. */
  format: SingleFileFormat | null;
  /** Slot this one is generated from; null when independently editable. */
  derivedFrom: ThemeAssetKey | null;
```

In `resolveVariant`, widen the context parameter to carry `format`:

```ts
async function resolveVariant(
  basename: string,
  resolve: AssetResolver,
  context: {
    key: ThemeAssetKey;
    variant: ThemeAssetVariant;
    root: AppRoot;
    format?: SingleFileFormat;
  },
): Promise<ResolvedAsset> {
  const resolved = await resolve(basename, context);
  return { basename, ...resolved };
}
```

In `buildThemeCatalog`, inside the `keys.map` callback, read the entry fields and pass them on:

```ts
      const entry = theme.assets[key];
      const root: AppRoot = entry.root ?? "web";
      const format = entry.format ?? null;
      const defaultVariant = resolveAssetVariant(entry, "default");
      const proVariant = resolveAssetVariant(entry, "pro");
      const def = defaultVariant.mode === "asset"
        ? await resolveVariant(defaultVariant.path, resolve, {
            key, variant: "default", root, ...(format ? { format } : {}),
          })
        : null;
      const pro = proVariant.mode === "asset"
        ? await resolveVariant(proVariant.path, resolve, {
            key, variant: "pro", root, ...(format ? { format } : {}),
          })
        : null;
```

and add to the returned object, next to `deprecated`:

```ts
        format,
        derivedFrom: entry.derivedFrom ?? null,
```

Finally re-export the type at the bottom of the file:

```ts
export type { AppRoot, ThemeAssetKey, ThemeAssetVariant, SingleFileFormat };
```

- [ ] **Step 5: Make the production resolver honor `format`**

In `apps/web/src/lib/themes/catalog-server.ts`, inside `fsAssetResolver`, replace the probe loop's source list. Immediately before `for (const format of TRIPLET_EXTENSIONS) {` insert:

```ts
  // A single-file slot has exactly one legal container; probing the triplet
  // would resolve a stale sibling that nothing renders.
  const extensions = context?.format ? [context.format] : TRIPLET_EXTENSIONS;
```

and change the loop header to:

```ts
  for (const format of extensions) {
```

Note the loop body already returns `format` from the loop variable, so a `.jpg` or `.ico` reports its own format. It also already handles sharp failing to decode a file by returning the file with null dimensions — which is exactly what happens for `.ico`, since sharp cannot decode it.

- [ ] **Step 6: Carry both fields on the upload target**

In `apps/web/src/lib/themes/upload-target.ts`, add to the `ok: true` branch of `UploadTarget`:

```ts
      /** Fixed extension for a single-file slot; null for a triplet. */
      format: SingleFileFormat | null;
      /** Set when the slot is generated from another — uploads are refused. */
      derivedFrom: ThemeAssetKey | null;
```

Import `SingleFileFormat` and `ThemeAssetKey` from `./theme-registry`, then in `resolveVariantBasename` compute them once after the `root` line:

```ts
  const format = entry.format ?? null;
  const derivedFrom = entry.derivedFrom ?? null;
```

and add `format,` and `derivedFrom,` to **both** `ok: true` returns in that function.

- [ ] **Step 7: Run the catalog tests**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec vitest run src/lib/themes/__tests__/catalog.test.ts`

Expected: the two "leaves ... null" tests now PASS. The three referencing `landing.og-image` and `brand.favicon-ico` still FAIL — those slots arrive in Task 8. This is expected; do not register the slots early.

- [ ] **Step 8: Typecheck**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec tsc --noEmit`

Expected: no errors. If `SlotCatalogEntry` consumers complain about the two new required fields, fix the construction site in `catalog.ts` — do not make the fields optional.

- [ ] **Step 9: Commit**

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito add apps/web/src/lib/themes/theme-registry.ts apps/web/src/lib/themes/catalog.ts apps/web/src/lib/themes/catalog-server.ts apps/web/src/lib/themes/upload-target.ts apps/web/src/lib/themes/__tests__/catalog.test.ts
```

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito commit -m "feat(themes): teach the catalog single-file and derived slots

Two optional registry fields: format pins a slot to one extension
instead of the PNG/WebP/AVIF triplet, derivedFrom marks it generated.
Both absent on every existing slot, so nothing changes for them.

Wolfcito 🐾 @akawolfcito"
```

---

### Task 6: Serve and refuse — the API side

The GET must stream `.jpg` and `.ico` with the right content type; the POST must refuse a derived slot before touching disk.

**Files:**
- Modify: `apps/web/src/app/api/dev/theme-asset/route.ts:62-115` (PREVIEW_FORMATS + GET) and the POST body around line 241
- Test: `apps/web/src/app/api/dev/theme-asset/__tests__/route.test.ts` (append)

**Interfaces:**
- Consumes: `UploadTarget.format` and `UploadTarget.derivedFrom` from Task 5.
- Produces: no new exports. POST returns HTTP 400 with `{ ok: false, error: "<key> is derived from <sourceKey> — replace that slot instead", code: "derived-slot" }` for a derived slot.

- [ ] **Step 1: Write the failing test**

Append to `apps/web/src/app/api/dev/theme-asset/__tests__/route.test.ts` (match the file's existing mock setup and helper names — read the top of the file first; the block below assumes its `POST` import and a `formDataRequest`-style helper, so adapt the call shape to whatever that file already uses):

```ts
describe("derived slots", () => {
  it("refuses an upload to a derived slot with 400", async () => {
    const form = new FormData();
    form.set("themeId", "candy-forest");
    form.set("key", "brand.favicon-ico");
    form.set("variant", "default");
    form.set("file", new File([Buffer.alloc(64, 1)], "favicon.ico"));
    const response = await POST(
      new Request("http://localhost/api/dev/theme-asset", { method: "POST", body: form }),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe("derived-slot");
    expect(body.error).toMatch(/brand\.favicon/);
  });

  it("does not write anything when it refuses a derived slot", async () => {
    const form = new FormData();
    form.set("themeId", "candy-forest");
    form.set("key", "brand.apple-icon");
    form.set("variant", "default");
    form.set("file", new File([Buffer.alloc(64, 1)], "apple-icon.png"));
    await POST(
      new Request("http://localhost/api/dev/theme-asset", { method: "POST", body: form }),
    );
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec vitest run src/app/api/dev/theme-asset/__tests__/route.test.ts`

Expected: FAIL — the slots do not exist yet, so `resolveUploadTarget` returns `ok: false` and the status is 400 but the `code` is not `derived-slot`. Both new tests fail on the body assertions.

- [ ] **Step 3: Widen the preview formats**

In `apps/web/src/app/api/dev/theme-asset/route.ts`, replace the `PREVIEW_FORMATS` constant with:

```ts
/** Probe order matches the catalog's, so the preview shows the same file the
 *  catalog reports dimensions for. Single-file slots probe only their own
 *  container — see the `format` narrowing in GET. */
const PREVIEW_FORMATS = [
  { extension: "png", type: "image/png" },
  { extension: "webp", type: "image/webp" },
  { extension: "avif", type: "image/avif" },
  { extension: "jpg", type: "image/jpeg" },
  { extension: "ico", type: "image/x-icon" },
] as const;
```

In `GET`, immediately before the `for (const { extension, type } of PREVIEW_FORMATS)` loop, insert:

```ts
  const formats = target.format
    ? PREVIEW_FORMATS.filter((candidate) => candidate.extension === target.format)
    : PREVIEW_FORMATS;
```

and change the loop header to `for (const { extension, type } of formats) {`.

- [ ] **Step 4: Refuse derived slots in POST**

In `POST`, immediately after the block that returns 400 when `!target.ok` (before the `MAX_BYTES` check and before any file handling), insert:

```ts
  // A derived slot has no independent source of truth — writing it would be
  // undone by the next regeneration. Refused here, not just hidden in the UI.
  if (target.derivedFrom) {
    return NextResponse.json(
      {
        ok: false,
        error: `${key} is derived from ${target.derivedFrom} — replace that slot instead`,
        code: "derived-slot",
      },
      { status: 400 },
    );
  }
```

Place it so it also guards the variant-mode branch above — if the mode-change branch runs first in the current file order, move this check above that branch too. A derived slot's mode must not be editable either.

- [ ] **Step 5: Run the route tests**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec vitest run src/app/api/dev/theme-asset/__tests__/route.test.ts`

Expected: the existing tests PASS. The two new ones still FAIL — the slots arrive in Task 8.

- [ ] **Step 6: Commit**

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito add apps/web/src/app/api/dev/theme-asset/route.ts apps/web/src/app/api/dev/theme-asset/__tests__/route.test.ts
```

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito commit -m "feat(theme-asset): stream jpg/ico previews, refuse derived slots

The preview route learns two more containers, narrowed to the slot's
declared format. A POST to a derived slot is refused with 400 before
any disk work — the server closes the contract, not the UI.

Wolfcito 🐾 @akawolfcito"
```

---

### Task 7: Writing a single-file JPG slot

`landing.og-image` is the only editable single-file slot. It needs `replaceAssetFamilyAtomic` to write one `.jpg` instead of a triplet, and to reject a source that is not exactly 1200×630.

**Files:**
- Modify: `apps/web/src/lib/themes/asset-triplet.ts:20-24,69-76,90-99,155-162,314-383`
- Modify: `apps/web/src/lib/themes/theme-registry.ts` (`ThemeAssetEntry.exactSize`)
- Modify: `apps/web/src/lib/themes/upload-target.ts` (carry `exactSize`)
- Modify: `apps/web/src/app/api/dev/theme-asset/route.ts` (pass `format` + `exactSize` to the replace call)
- Test: `apps/web/src/lib/themes/__tests__/asset-triplet.test.ts` (append)

**Interfaces:**
- Consumes: `SingleFileFormat` from Task 5.
- Produces:
  - `ThemeAssetEntry.exactSize?: { width: number; height: number }`
  - `ReplaceOptions` gains `format?: SingleFileFormat` and `exactSize?: { width: number; height: number } | null`
  - `UploadTarget` (ok branch) gains `exactSize: { width: number; height: number } | null`

- [ ] **Step 1: Write the failing test**

Append to `apps/web/src/lib/themes/__tests__/asset-triplet.test.ts` (reuse the file's existing tmpdir fixture and helper names — read its top before writing):

```ts
describe("single-file jpg slots", () => {
  it("writes exactly one .jpg and no triplet siblings", async () => {
    const source = await sharp({
      create: { width: 1200, height: 630, channels: 3, background: { r: 20, g: 30, b: 40 } },
    })
      .png()
      .toBuffer();

    const result = await replaceAssetFamilyAtomic({
      basename: "/og/test-card",
      input: source,
      rootDir: sandbox,
      format: "jpg",
      exactSize: { width: 1200, height: 630 },
    });

    expect(result.files).toEqual(["/og/test-card.jpg"]);
    const names = await fs.readdir(path.join(sandbox, "public/og"));
    expect(names).toEqual(["test-card.jpg"]);
  });

  it("produces a decodable jpeg at the declared size", async () => {
    const source = await sharp({
      create: { width: 1200, height: 630, channels: 3, background: { r: 20, g: 30, b: 40 } },
    })
      .png()
      .toBuffer();
    await replaceAssetFamilyAtomic({
      basename: "/og/test-card",
      input: source,
      rootDir: sandbox,
      format: "jpg",
      exactSize: { width: 1200, height: 630 },
    });
    const written = await fs.readFile(path.join(sandbox, "public/og/test-card.jpg"));
    const meta = await sharp(written).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.width).toBe(1200);
    expect(meta.height).toBe(630);
  });

  it("rejects a source whose dimensions are not the declared exact size", async () => {
    const wrong = await sharp({
      create: { width: 800, height: 600, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .png()
      .toBuffer();

    await expect(
      replaceAssetFamilyAtomic({
        basename: "/og/test-card",
        input: wrong,
        rootDir: sandbox,
        format: "jpg",
        exactSize: { width: 1200, height: 630 },
      }),
    ).rejects.toMatchObject({ code: "invalid-image" });
  });

  it("still writes the full triplet when no format is declared", async () => {
    const source = await sharp({
      create: { width: 64, height: 64, channels: 4, background: { r: 1, g: 2, b: 3, alpha: 1 } },
    })
      .png()
      .toBuffer();
    const result = await replaceAssetFamilyAtomic({
      basename: "/art/plain",
      input: source,
      rootDir: sandbox,
    });
    expect(result.files).toEqual(["/art/plain.png", "/art/plain.webp", "/art/plain.avif"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec vitest run src/lib/themes/__tests__/asset-triplet.test.ts`

Expected: FAIL — `format` is not a known option, so a triplet is written and `result.files` has three entries.

- [ ] **Step 3: Widen the member type and the suffix guard**

In `apps/web/src/lib/themes/asset-triplet.ts`:

Change `FamilyMember.extension` to:

```ts
  extension: "png" | "webp" | "avif" | "jpg";
```

Change `isSafeFamilySuffix` to accept `.jpg`:

```ts
function isSafeFamilySuffix(value: unknown): value is string {
  return typeof value === "string"
    && /^(?:\.(?:png|webp|avif|jpg)|-\d+w\.(?:webp|avif))$/.test(value);
}
```

Change `expectedSharpFormat` so a `.jpg` member validates against sharp's name for it:

```ts
function expectedSharpFormat(extension: FamilyMember["extension"]): string {
  if (extension === "avif") return "heif";
  if (extension === "jpg") return "jpeg";
  return extension;
}
```

Also widen the `stubMember` extension detection so an existing `.jpg` is discovered for undo:

```ts
function stubMember(basename: string, suffix: string): FamilyMember {
  const extension = suffix.endsWith(".avif")
    ? "avif"
    : suffix.endsWith(".webp")
      ? "webp"
      : suffix.endsWith(".jpg")
        ? "jpg"
        : "png";
```

and the discovery regex in `discoverExistingFamilyMembers`:

```ts
  const pattern = new RegExp(`^${stem}((?:\\.(?:png|webp|avif|jpg))|(?:-\\d+w\\.(?:webp|avif)))$`);
```

- [ ] **Step 4: Add the options and the single-file branch**

Add to `ReplaceOptions`:

```ts
  /** Write ONE file with this extension instead of the triplet. */
  format?: SingleFileFormat;
  /** Reject a source that is not exactly this size. */
  exactSize?: { width: number; height: number } | null;
```

Import `SingleFileFormat` from `./theme-registry`.

Change `buildFamily`'s signature and add the single-file branch at the top of its body:

```ts
async function buildFamily(
  basename: string,
  input: Buffer,
  profile: ResponsiveAssetProfile | null,
  options?: { format?: SingleFileFormat; exactSize?: { width: number; height: number } | null },
): Promise<{ members: FamilyMember[]; result: AssetFamilyResult }> {
  const canonical = await canonicalize(input, profile);

  if (options?.exactSize) {
    const { width, height } = options.exactSize;
    if (canonical.width !== width || canonical.height !== height) {
      throw new AssetFamilyError(
        "invalid-image",
        `this slot requires exactly ${width}x${height}px, got ${canonical.width}x${canonical.height}px`,
      );
    }
  }

  if (options?.format === "jpg") {
    // Flattened onto white: JPEG carries no alpha, and letting sharp pick the
    // matte turns transparent pixels black.
    const jpg = await sharp(canonical.png)
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();
    const member: FamilyMember = {
      suffix: ".jpg",
      url: `${basename}.jpg`,
      extension: "jpg",
      width: canonical.width,
      height: canonical.height,
      buffer: jpg,
    };
    await validateMember(member, canonical.png, false);
    return {
      members: [member],
      result: {
        files: [member.url],
        width: canonical.width,
        height: canonical.height,
        responsiveWidths: [],
        sourceSignature: await normalizedVisualSignature(canonical.png),
      },
    };
  }

  const members: FamilyMember[] = [];
  // ... existing triplet body unchanged from here
```

Remove the now-duplicated `const canonical = await canonicalize(...)` and `const members: FamilyMember[] = []` lines from the original position so they are declared exactly once.

Then, in `replaceAssetFamilyAtomic`, pass the options through to its `buildFamily` call:

```ts
  const { members, result } = await buildFamily(basename, input, profile ?? null, {
    format: options.format,
    exactSize: options.exactSize ?? null,
  });
```

(Match the surrounding variable names in that function — read it before editing.)

- [ ] **Step 5: Carry `exactSize` on the upload target and pass it from the route**

In `theme-registry.ts`, add to `ThemeAssetEntry`:

```ts
  /** Reject an upload that is not exactly these dimensions. For slots where a
   *  wrong aspect ratio breaks a consumer that cannot report it — an Open
   *  Graph card silently letterboxes in every social preview. */
  exactSize?: { width: number; height: number };
```

In `upload-target.ts`, add `exactSize: { width: number; height: number } | null` to the `ok: true` branch, compute `const exactSize = entry.exactSize ?? null;` next to `format`, and add `exactSize,` to both `ok: true` returns.

In `route.ts`, add both to the `replaceAssetFamilyAtomic` call:

```ts
      format: target.format ?? undefined,
      exactSize: target.exactSize,
```

- [ ] **Step 6: Run the asset-triplet tests**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec vitest run src/lib/themes/__tests__/asset-triplet.test.ts`

Expected: PASS — all existing tests plus the 4 new ones. If `validateMember`'s visual-distance check fails on the JPEG, the cause is the white matte against a transparent reference: confirm the test source is opaque. Do not raise `VISUAL_DISTANCE_LIMIT` to make it pass.

- [ ] **Step 7: Typecheck**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec tsc --noEmit`

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito add apps/web/src/lib/themes/asset-triplet.ts apps/web/src/lib/themes/theme-registry.ts apps/web/src/lib/themes/upload-target.ts apps/web/src/app/api/dev/theme-asset/route.ts apps/web/src/lib/themes/__tests__/asset-triplet.test.ts
```

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito commit -m "feat(themes): write single-file jpg slots with an exact-size gate

A slot declaring format jpg now writes one flattened JPEG instead of
a triplet, and exactSize rejects a source with the wrong dimensions
up front — an OG card that letterboxes reports nothing on its own.

Wolfcito 🐾 @akawolfcito"
```

---

### Task 8: Register the three slots

Everything is in place; now the slots exist and the Task 5/6 tests go green.

**Files:**
- Modify: `apps/web/src/lib/themes/theme-registry.ts` — `ThemeAssetKey` union (near line 253, next to `brand.favicon`), the `candy-forest` assets block (near line 770, after the landing additions), `THEME_SLOT_SURFACES` (near line 988)
- Test: the tests appended in Tasks 5 and 6 (no new test code)

**Interfaces:**
- Consumes: `format`, `derivedFrom`, `exactSize` from Tasks 5 and 7.
- Produces: keys `"landing.og-image"`, `"brand.apple-icon"`, `"brand.favicon-ico"`.

- [ ] **Step 1: Add the keys to the union**

In `apps/web/src/lib/themes/theme-registry.ts`, in the `ThemeAssetKey` union, immediately after `| "brand.favicon"` add:

```ts
  | "brand.apple-icon"
  | "brand.favicon-ico"
  | "landing.og-image"
```

- [ ] **Step 2: Run the coverage audit to see what breaks**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec tsc --noEmit`

Expected: FAIL — `THEMES["candy-forest"].assets` no longer satisfies `Record<ThemeAssetKey, ThemeAssetEntry>`, and `THEME_SLOT_SURFACES` is missing three keys. Both errors name the missing keys. This is the type system doing the work: every theme must define every slot.

- [ ] **Step 3: Register the entries**

In the `candy-forest` assets block, after the `landing.slide-web-4` line, add:

```ts
      // Brand icons — apps/landing/public. The two below are DERIVED from
      // brand.favicon: replacing that slot regenerates them, and the upload
      // API refuses a direct write. See lib/themes/icon-derivation.ts.
      "brand.favicon-ico": {
        root: "landing", format: "ico", derivedFrom: "brand.favicon",
        default: "/favicon",
        usedIn: ["Landing — browser favicon", "↳ apps/landing · src/app/layout.tsx (icons.icon)"],
      },
      "brand.apple-icon": {
        root: "landing", format: "png", derivedFrom: "brand.favicon",
        default: "/apple-icon",
        usedIn: ["Landing — apple touch icon", "↳ apps/landing · src/app/layout.tsx (icons.apple)"],
      },
      // The social card. Editable on its own — it is composed art, not a crop
      // of the mark. 1200x630 is enforced: every social preview letterboxes a
      // wrong ratio silently.
      "landing.og-image": {
        root: "landing", format: "jpg",
        default: "/og/chesscito-landing",
        exactSize: { width: 1200, height: 630 },
        usedIn: [
          "Landing — Open Graph / Twitter card",
          "↳ apps/landing · src/app/layout.tsx (openGraph.images, twitter.images)",
        ],
      },
```

- [ ] **Step 4: Add the surfaces**

In `THEME_SLOT_SURFACES`, next to the existing `"brand.favicon"` entry, add the three keys with the same surface value that `"brand.favicon"` uses. Read that entry first and mirror it exactly — do not invent a new surface name.

- [ ] **Step 5: Typecheck**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec tsc --noEmit`

Expected: no errors.

- [ ] **Step 6: Run every theme test**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec vitest run src/lib/themes src/app/api/dev/theme-asset`

Expected: PASS, including the five catalog tests from Task 5 and the two route tests from Task 6.

If `catalog-assets-on-disk.test.ts` or `landing-assets.test.ts` fails, read what it asserts before touching it: those tests verify the declared basenames exist on disk. `/favicon.ico`, `/apple-icon.png` and `/og/chesscito-landing.jpg` all exist in `apps/landing/public`, so a failure means the test assumes the triplet extensions — teach it to honor `entry.format`, do not exempt the slots.

- [ ] **Step 7: Run the runtime coverage audit**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web theme:coverage`

Expected: exit 0. If it reports the new slots as uncovered, the `usedIn` entries above name the real consumer (`apps/landing/src/app/layout.tsx`) — make the audit recognize a landing-rooted consumer rather than adding an exception list.

- [ ] **Step 8: Commit**

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito add apps/web/src/lib/themes/theme-registry.ts
```

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito commit -m "feat(themes): catalog the landing OG card, apple-icon and favicon

Three slots that were edited by hand until now. The OG card is
editable with a 1200x630 gate; the two icons are derived from
brand.favicon and read-only.

Wolfcito 🐾 @akawolfcito"
```

---

### Task 9: Derive on replace

Replacing `brand.favicon` regenerates the five icons. Write-then-derive: the master is already written when derivation runs, and a derivation failure is reported, not rolled back.

**Files:**
- Modify: `apps/web/src/app/api/dev/theme-asset/route.ts` (POST, after the `replaceAssetFamilyAtomic` call around line 271)
- Test: `apps/web/src/app/api/dev/theme-asset/__tests__/route.test.ts` (append)

**Interfaces:**
- Consumes: `deriveBrandIcons` (Task 2), `writeDerivedIcons` + `DerivedIconWriteResult` (Task 3), `BRAND_ICON_MASTER` (Task 2).
- Produces: the POST success body gains an optional `derived` field, shaped `{ ok: true; files: string[] } | { ok: false; error: string }`. Absent for every slot other than `brand.favicon` / `default`.

- [ ] **Step 1: Write the failing test**

Append to `apps/web/src/app/api/dev/theme-asset/__tests__/route.test.ts` (mock the two derivation modules at the top of the file alongside the existing mocks — follow the file's established `vi.mock` style):

```ts
describe("brand icon derivation on replace", () => {
  it("derives and reports the files after replacing brand.favicon default", async () => {
    mocks.writeDerivedIcons.mockResolvedValue({
      ok: true,
      files: ["landing/public/favicon.ico", "web/src/app/icon.png"],
    });
    const form = new FormData();
    form.set("themeId", "candy-forest");
    form.set("key", "brand.favicon");
    form.set("variant", "default");
    form.set("file", new File([Buffer.alloc(64, 1)], "wolf.png"));
    const response = await POST(
      new Request("http://localhost/api/dev/theme-asset", { method: "POST", body: form }),
    );
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.derived).toEqual({
      ok: true,
      files: ["landing/public/favicon.ico", "web/src/app/icon.png"],
    });
  });

  it("keeps the replace successful when derivation fails", async () => {
    mocks.writeDerivedIcons.mockResolvedValue({ ok: false, error: "disk on fire" });
    const form = new FormData();
    form.set("themeId", "candy-forest");
    form.set("key", "brand.favicon");
    form.set("variant", "default");
    form.set("file", new File([Buffer.alloc(64, 1)], "wolf.png"));
    const response = await POST(
      new Request("http://localhost/api/dev/theme-asset", { method: "POST", body: form }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.derived).toEqual({ ok: false, error: "disk on fire" });
  });

  it("does not derive when the pro variant is replaced", async () => {
    const form = new FormData();
    form.set("themeId", "candy-forest");
    form.set("key", "brand.favicon");
    form.set("variant", "pro");
    form.set("file", new File([Buffer.alloc(64, 1)], "wolf-pro.png"));
    const response = await POST(
      new Request("http://localhost/api/dev/theme-asset", { method: "POST", body: form }),
    );
    expect((await response.json()).derived).toBeUndefined();
    expect(mocks.writeDerivedIcons).not.toHaveBeenCalled();
  });

  it("does not derive for an unrelated slot", async () => {
    const form = new FormData();
    form.set("themeId", "candy-forest");
    form.set("key", "hub.portal");
    form.set("variant", "default");
    form.set("file", new File([Buffer.alloc(64, 1)], "portal.png"));
    const response = await POST(
      new Request("http://localhost/api/dev/theme-asset", { method: "POST", body: form }),
    );
    expect((await response.json()).derived).toBeUndefined();
    expect(mocks.writeDerivedIcons).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec vitest run src/app/api/dev/theme-asset/__tests__/route.test.ts`

Expected: FAIL — `body.derived` is `undefined` in the first two tests.

- [ ] **Step 3: Implement the hook**

In `route.ts`, add the imports:

```ts
import { deriveBrandIcons } from "@/lib/themes/icon-derivation";
import {
  writeDerivedIcons,
  type DerivedIconWriteResult,
} from "@/lib/themes/derived-icons-writer";
```

Add this helper above `POST`:

```ts
/**
 * Regenerate the brand icons from a freshly replaced master.
 *
 * Write-then-derive: the master is already on disk when this runs, and a
 * failure here is reported rather than rolled back. The icons are recoverable
 * with `pnpm icons:generate`; silently reverting a successful replace is the
 * worse failure.
 *
 * Only the `default` variant derives — a theme's `pro` art must not change the
 * browser favicon. These icons are brand, not theme.
 */
async function deriveBrandIconsFrom(source: Buffer): Promise<DerivedIconWriteResult> {
  try {
    return await writeDerivedIcons(await deriveBrandIcons(source));
  } catch (error) {
    return { ok: false, error: `derivation failed: ${String(error)}` };
  }
}
```

Then replace the POST's final success return with:

```ts
  console.info("[dev/theme-asset]", { themeId, key, variant, root: target.root, basename: target.basename });

  const derived = key === "brand.favicon" && typedVariant === "default"
    ? await deriveBrandIconsFrom(buffer)
    : undefined;
  if (derived && !derived.ok) {
    console.warn("[dev/theme-asset] brand icon derivation failed", derived.error);
  }

  return NextResponse.json({
    ok: true,
    basename: target.basename,
    ...result,
    ...(derived ? { derived } : {}),
  });
```

- [ ] **Step 4: Run the route tests**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec vitest run src/app/api/dev/theme-asset/__tests__/route.test.ts`

Expected: PASS — all tests including the four new ones.

- [ ] **Step 5: Commit**

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito add apps/web/src/app/api/dev/theme-asset/route.ts apps/web/src/app/api/dev/theme-asset/__tests__/route.test.ts
```

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito commit -m "feat(theme-asset): regenerate brand icons when the wolf is replaced

Replacing brand.favicon default now derives all five icons in both
apps and reports them. A derivation failure leaves the replace
successful and says so — icons:generate recovers it.

Wolfcito 🐾 @akawolfcito"
```

---

### Task 10: Catalog UI for derived slots

A derived slot must look derived: no upload control, a badge naming its source, and the derivation warning surfaced after a Replace.

**Files:**
- Modify: `apps/web/src/app/dev/theme-builder/page.tsx:73-149` (VariantCell), `:211-276` (the slot section)
- Modify: `apps/web/src/app/dev/theme-builder/upload-control.tsx` (surface `derived` from the response)
- Test: `apps/web/src/app/dev/theme-builder/__tests__/derived-slot-ui.test.tsx` (create)

**Interfaces:**
- Consumes: `SlotCatalogEntry.derivedFrom` (Task 5), the POST `derived` field (Task 9).
- Produces: no new exports.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/app/dev/theme-builder/__tests__/derived-slot-ui.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { UploadControl } from "../upload-control";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("UploadControl on a derived slot", () => {
  it("renders no file input and names the source slot", () => {
    render(
      <UploadControl
        themeId="candy-forest"
        slotKey="brand.favicon-ico"
        variant="default"
        mode="asset"
        hasBackup={false}
        derivedFrom="brand.favicon"
      />,
    );
    expect(screen.queryByLabelText(/replace/i)).toBeNull();
    expect(screen.getByText(/derived from brand\.favicon/i)).toBeInTheDocument();
  });
});

describe("UploadControl derivation reporting", () => {
  it("warns when the replace succeeded but derivation did not", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            ok: true,
            basename: "/art/favicon-wolf",
            files: ["/art/favicon-wolf.png"],
            derived: { ok: false, error: "disk on fire" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    render(
      <UploadControl
        themeId="candy-forest"
        slotKey="brand.favicon"
        variant="default"
        mode="asset"
        hasBackup={false}
      />,
    );

    const input = screen.getByLabelText(/replace/i) as HTMLInputElement;
    await userEvent.upload(input, new File(["x"], "wolf.png", { type: "image/png" }));

    await waitFor(() => {
      expect(screen.getByText(/icons not regenerated/i)).toBeInTheDocument();
      expect(screen.getByText(/icons:generate/i)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec vitest run src/app/dev/theme-builder/__tests__/derived-slot-ui.test.tsx`

Expected: FAIL — `derivedFrom` is not a prop of `UploadControl`.

- [ ] **Step 3: Implement in `upload-control.tsx`**

Read the file first — it already owns the upload state machine. Make three changes:

1. Add `derivedFrom?: string` to the props type.
2. Return the read-only branch before any upload UI:

```tsx
  if (derivedFrom) {
    return (
      <div
        data-testid={`derived-slot-${slotKey}`}
        className="mt-2 rounded-md border border-sky-700/40 bg-sky-950/30 px-2 py-1 text-[11px] text-sky-300"
      >
        derived from {derivedFrom} — replace that slot to regenerate
      </div>
    );
  }
```

3. Where the successful response is handled, read `derived` off the parsed body and, when it is present and `ok === false`, render a warning next to the success state:

```tsx
      {derivedWarning && (
        <div className="mt-1 rounded-md border border-amber-600/40 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-300">
          ⚠ saved, but icons not regenerated — {derivedWarning}. Run{" "}
          <code>pnpm icons:generate</code>
        </div>
      )}
```

Store it with `const [derivedWarning, setDerivedWarning] = useState<string | null>(null)` and set it from the response: `setDerivedWarning(body.derived && !body.derived.ok ? body.derived.error : null)`. Clear it at the start of each upload.

- [ ] **Step 4: Pass `derivedFrom` down in `page.tsx`**

Add `derivedFrom?: string | null` to `VariantCell`'s props, pass it to `UploadControl` as `derivedFrom={derivedFrom ?? undefined}`, and at both `VariantCell` call sites add `derivedFrom={slot.derivedFrom}`.

In the slot header, next to the `apps/{slot.root}` badge, add:

```tsx
                        {slot.derivedFrom && (
                          <span
                            data-testid={`theme-slot-derived-${slot.key}`}
                            className="rounded-full border border-sky-700/60 bg-sky-950/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-300"
                            title={`Generated from ${slot.derivedFrom}`}
                          >
                            derived
                          </span>
                        )}
```

- [ ] **Step 5: Run the UI test**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec vitest run src/app/dev/theme-builder`

Expected: PASS — 2 new tests plus whatever already existed in that directory.

- [ ] **Step 6: Run the full suite**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web test`

Expected: PASS, at or above the 5003 baseline. **Read the tail of the output, not just the counts** — vitest exits non-zero on `Unhandled Errors` even with every test green.

- [ ] **Step 7: Typecheck**

Run: `pnpm -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito/apps/web exec tsc --noEmit`

Expected: no errors.

- [ ] **Step 8: Verify by hand in the running builder**

Start the dev server and open `/dev/theme-builder?theme=candy-forest`. Confirm:
- `landing.og-image` previews the JPG card and offers Replace.
- `brand.apple-icon` and `brand.favicon-ico` preview their files, show the `derived` badge, and offer no Replace.
- Replacing `brand.favicon` default with any square image updates all five icons on disk.

Report what you saw. Do not verify a deploy — that is the founder's, per CLAUDE.md.

- [ ] **Step 9: Commit**

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito add apps/web/src/app/dev/theme-builder/page.tsx apps/web/src/app/dev/theme-builder/upload-control.tsx apps/web/src/app/dev/theme-builder/__tests__/derived-slot-ui.test.tsx
```

```bash
git -C /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito commit -m "feat(theme-builder): show derived slots as read-only with their source

A derived slot loses its upload control and names the slot it comes
from, and a failed derivation surfaces next to the successful save
with the recovery command. Full suite green.

Wolfcito 🐾 @akawolfcito"
```

---

## Closing the cluster

Per the Cluster Closure Protocol in CLAUDE.md, after Task 10 lands on `main`:

- [ ] Add `icons:generate:check` to whatever CI job already runs `art:sync-landing:check`, so icon drift fails the same way art drift does.
- [ ] Write `docs/handoffs/2026-07-22-theme-builder-brand-icons-handoff.md` with state, next steps, and open questions.
- [ ] Update `MEMORY.md` if the derived-slot concept belongs in the index — it changes the rule that "one slot = one editable file".
