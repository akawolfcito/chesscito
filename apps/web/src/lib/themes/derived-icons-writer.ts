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
