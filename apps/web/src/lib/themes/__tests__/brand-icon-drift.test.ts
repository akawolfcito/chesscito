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
