import { promises as fs } from "node:fs";
import path from "node:path";

import { replaceAssetFamilyAtomic } from "../src/lib/themes/asset-triplet";
import { getResponsiveAssetProfile } from "../src/lib/themes/responsive-asset-profiles";

const CONFIRMED_STALE_BASENAMES = [
  "/art/avatar-lite-hub",
  "/art/avatar-pro",
] as const;

async function main(): Promise<void> {
  const profile = getResponsiveAssetProfile("hub.avatar-lite");
  if (!profile) throw new Error("hub.avatar-lite responsive profile is missing");

  for (const basename of CONFIRMED_STALE_BASENAMES) {
    const input = await fs.readFile(
      path.join(process.cwd(), "public", `${basename.replace(/^\//, "")}.png`),
    );
    const result = await replaceAssetFamilyAtomic({ basename, input, profile });
    process.stdout.write(
      `${basename}: ${result.width}x${result.height}; ${result.files.join(", ")}\n`,
    );
  }
}

void main();
