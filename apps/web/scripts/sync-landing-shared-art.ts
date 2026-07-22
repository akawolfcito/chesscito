/**
 * Mirror web-owned art into the landing app.
 *
 * `apps/landing` is a separate Next app, so anything both apps render exists
 * twice on disk. The theme-builder catalogs the WEB copy as the single slot
 * (one slot = one file); this script propagates a replace to the landing.
 *
 *   pnpm art:sync-landing          # copy what drifted
 *   pnpm art:sync-landing --check  # report drift, exit 1, write nothing
 *
 * `--check` is the CI-friendly form. Drift is not theoretical: before this
 * existed, redesign/icons/{fingerprint,star} had already diverged.
 *
 * Only basenames in SHARED_LANDING_ASSETS are touched, and always web →
 * landing. Landing-owned art (`root: "landing"` slots) is never overwritten.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

import { SHARED_LANDING_ASSETS } from "../src/lib/themes/shared-landing-assets";
import { resolveAppRoot } from "../src/lib/themes/asset-roots";

const CHECK_MODE = process.argv.includes("--check");
const EXTENSIONS = ["png", "webp", "avif"] as const;

const WEB_PUBLIC = path.join(resolveAppRoot("web"), "public");
const LANDING_PUBLIC = path.join(resolveAppRoot("landing"), "public");

type FileState =
  | { status: "in-sync" }
  | { status: "missing-source" }
  | { status: "drifted"; reason: "absent" | "content" };

async function read(file: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(file);
  } catch {
    return null;
  }
}

async function inspect(relative: string): Promise<FileState> {
  const source = await read(path.join(WEB_PUBLIC, relative));
  if (!source) return { status: "missing-source" };
  const target = await read(path.join(LANDING_PUBLIC, relative));
  if (!target) return { status: "drifted", reason: "absent" };
  return source.equals(target)
    ? { status: "in-sync" }
    : { status: "drifted", reason: "content" };
}

async function copy(relative: string): Promise<void> {
  const destination = path.join(LANDING_PUBLIC, relative);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(path.join(WEB_PUBLIC, relative), destination);
}

async function main(): Promise<void> {
  const drifted: string[] = [];
  const missingSources: string[] = [];

  for (const basename of SHARED_LANDING_ASSETS) {
    for (const extension of EXTENSIONS) {
      const relative = `${basename.replace(/^\//, "")}.${extension}`;
      const state = await inspect(relative);
      if (state.status === "missing-source") {
        missingSources.push(relative);
        continue;
      }
      if (state.status !== "drifted") continue;
      drifted.push(`${relative} (${state.reason})`);
      if (!CHECK_MODE) await copy(relative);
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: CHECK_MODE ? "check" : "sync",
        sharedBasenames: SHARED_LANDING_ASSETS.length,
        drifted,
        missingSources,
      },
      null,
      2,
    ),
  );

  // A missing source means the manifest names art the web app no longer has —
  // a real inconsistency in either case.
  if (missingSources.length > 0 || (CHECK_MODE && drifted.length > 0)) {
    process.exitCode = 1;
  }
}

void main();
