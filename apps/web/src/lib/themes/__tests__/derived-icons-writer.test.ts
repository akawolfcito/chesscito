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

  // These destinations are the first in the theme builder that live outside
  // public/ — src/app is where the source code is. A malformed relative path
  // here would not corrupt an asset, it would overwrite a component.
  it("refuses a destination that escapes the app root", async () => {
    const result = await writeDerivedIcons([icon("../../src/app/layout.tsx")], {
      rootResolver: resolver,
    });
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/outside its app root/i),
    });
  });

  it("writes nothing at all when one destination is rejected", async () => {
    await writeDerivedIcons(
      [icon("src/app/icon.png"), icon("../../src/app/layout.tsx")],
      { rootResolver: resolver },
    );
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
