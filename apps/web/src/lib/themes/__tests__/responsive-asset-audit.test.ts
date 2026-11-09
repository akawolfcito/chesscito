import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { replaceAssetFamilyAtomic } from "../asset-triplet";
import { auditResponsiveFamily } from "../responsive-asset-audit";
import { getResponsiveAssetProfile } from "../responsive-asset-profiles";

let rootDir: string;
let publicDir: string;

beforeEach(async () => {
  rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "responsive-audit-test-"));
  publicDir = path.join(rootDir, "public");
  await fs.mkdir(path.join(publicDir, "art"), { recursive: true });
});

afterEach(async () => {
  await fs.rm(rootDir, { recursive: true, force: true });
});

async function approvedSource(width = 600): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height: 500,
      channels: 4,
      background: "#7c3aed",
    },
  }).png().toBuffer();
}

// Four of these five generate a complete responsive family — seven files
// each, AVIF included — through real sharp encoding. The file takes ~8s on an
// idle machine, so the 5s default only passed while nothing else competed for
// CPU: under the full suite it failed intermittently, and the failure said
// "timeout", never anything about the audit.
describe("responsive family audit", { timeout: 30_000 }, () => {
  it("classifies a generated family as healthy using decoded content", async () => {
    const profile = getResponsiveAssetProfile("hub.avatar-lite")!;
    await replaceAssetFamilyAtomic({
      basename: "/art/avatar",
      input: await approvedSource(),
      profile,
      rootDir,
    });
    const audit = await auditResponsiveFamily(
      { basename: "/art/avatar", slots: ["hub.avatar-lite"], profile },
      publicDir,
    );
    expect(audit.state).toBe("healthy");
    expect(audit.missing).toEqual([]);
    expect(audit.sourceSignature).toMatch(/^[a-f0-9]{64}$/);
  });

  it("detects stale content even when dimensions and format are correct", async () => {
    const profile = getResponsiveAssetProfile("hub.avatar-lite")!;
    await replaceAssetFamilyAtomic({
      basename: "/art/avatar",
      input: await approvedSource(),
      profile,
      rootDir,
    });
    const stale = await sharp({
      create: {
        width: 340,
        height: 382,
        channels: 4,
        background: "#facc15",
      },
    }).avif().toBuffer();
    await fs.writeFile(path.join(publicDir, "art/avatar-340w.avif"), stale);

    const audit = await auditResponsiveFamily(
      { basename: "/art/avatar", slots: ["hub.avatar-lite"], profile },
      publicDir,
    );
    expect(audit.state).toBe("stale");
    expect(audit.states).toContain("stale");
  });

  it("reports missing and orphan derivatives without modifying them", async () => {
    const profile = getResponsiveAssetProfile("hub.avatar-lite")!;
    await replaceAssetFamilyAtomic({
      basename: "/art/avatar",
      input: await approvedSource(),
      profile,
      rootDir,
    });
    await fs.rm(path.join(publicDir, "art/avatar-224w.webp"));
    await fs.copyFile(
      path.join(publicDir, "art/avatar-340w.webp"),
      path.join(publicDir, "art/avatar-999w.webp"),
    );

    const audit = await auditResponsiveFamily(
      { basename: "/art/avatar", slots: ["hub.avatar-lite"], profile },
      publicDir,
    );
    expect(audit.states).toContain("missing-derived");
    expect(audit.states).toContain("orphan-derived");
    expect(audit.orphan).toEqual(["/art/avatar-999w.webp"]);
  });

  it("reports a missing canonical optimized sibling as missing-derived", async () => {
    const profile = getResponsiveAssetProfile("hub.avatar-lite")!;
    await replaceAssetFamilyAtomic({
      basename: "/art/avatar",
      input: await approvedSource(),
      profile,
      rootDir,
    });
    await fs.rm(path.join(publicDir, "art/avatar.avif"));

    const audit = await auditResponsiveFamily(
      { basename: "/art/avatar", slots: ["hub.avatar-lite"], profile },
      publicDir,
    );
    expect(audit.state).toBe("missing-derived");
    expect(audit.missing).toContain("/art/avatar.avif");
  });

  it("marks an undersized canonical source as unknown-source", async () => {
    const profile = getResponsiveAssetProfile("shared.welcome-gift")!;
    await fs.writeFile(
      path.join(publicDir, "art/gift.png"),
      await approvedSource(120),
    );
    const audit = await auditResponsiveFamily(
      { basename: "/art/gift", slots: ["shared.welcome-gift"], profile },
      publicDir,
    );
    expect(audit.state).toBe("unknown-source");
    expect(audit.action).toBe("approve-source");
  });
});
