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
