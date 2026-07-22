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
