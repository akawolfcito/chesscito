import { promises as fs } from "node:fs";
import type { Dirent } from "node:fs";
import path from "node:path";
import sharp from "sharp";

import { normalizedVisualDistance, normalizedVisualSignature } from "./asset-family-visual";
import {
  responsiveDerivativeHeight,
  type ResponsiveAssetProfile,
} from "./responsive-asset-profiles";

const VISUAL_DISTANCE_LIMIT = 18;
const CANONICAL_EXTENSIONS = ["png", "webp", "avif"] as const;
const RESPONSIVE_EXTENSIONS = ["webp", "avif"] as const;

export type ResponsiveFamilyState =
  | "healthy"
  | "stale"
  | "missing-derived"
  | "inconsistent-dimensions"
  | "orphan-derived"
  | "unknown-source";

export type ResponsiveFamilyAudit = {
  basename: string;
  slots: string[];
  expected: string[];
  present: string[];
  missing: string[];
  orphan: string[];
  states: ResponsiveFamilyState[];
  state: ResponsiveFamilyState;
  action: "none" | "regenerate" | "approve-source" | "review";
  sourceDimensions: { width: number; height: number } | null;
  sourceSignature: string | null;
  visualDistances: Record<string, number>;
};

export type ResponsiveFamilyBinding = {
  basename: string;
  slots: string[];
  profile: ResponsiveAssetProfile;
};

function relOf(value: string): string {
  return value.replace(/^\/+/, "");
}

async function exists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

function expectedFiles(
  basename: string,
  profile: ResponsiveAssetProfile,
): string[] {
  return [
    ...CANONICAL_EXTENSIONS.map((extension) => `${basename}.${extension}`),
    ...profile.widths.flatMap((width) =>
      RESPONSIVE_EXTENSIONS.map(
        (extension) => `${basename}-${width}w.${extension}`,
      ),
    ),
  ];
}

function primaryState(states: ResponsiveFamilyState[]): ResponsiveFamilyState {
  const priority: ResponsiveFamilyState[] = [
    "unknown-source",
    "stale",
    "missing-derived",
    "inconsistent-dimensions",
    "orphan-derived",
    "healthy",
  ];
  return priority.find((state) => states.includes(state)) ?? "healthy";
}

function recommendedAction(
  state: ResponsiveFamilyState,
): ResponsiveFamilyAudit["action"] {
  if (state === "healthy") return "none";
  if (state === "unknown-source") return "approve-source";
  if (state === "stale" || state === "missing-derived") return "regenerate";
  return "review";
}

async function discoveredResponsiveFiles(
  publicDir: string,
  basename: string,
): Promise<string[]> {
  const relative = relOf(basename);
  const directory = path.join(publicDir, path.dirname(relative));
  const stem = path.basename(relative);
  let names: string[];
  try {
    names = await fs.readdir(directory);
  } catch {
    return [];
  }
  const pattern = new RegExp(
    `^${stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-\\d+w\\.(?:webp|avif)$`,
  );
  return names
    .filter((name) => pattern.test(name))
    .map((name) => `/${path.posix.join(path.dirname(relative), name)}`)
    .sort();
}

export async function auditResponsiveFamily(
  binding: ResponsiveFamilyBinding,
  publicDir = path.join(process.cwd(), "public"),
): Promise<ResponsiveFamilyAudit> {
  const expected = expectedFiles(binding.basename, binding.profile);
  const present: string[] = [];
  const missing: string[] = [];
  const visualDistances: Record<string, number> = {};
  const states = new Set<ResponsiveFamilyState>();

  for (const file of expected) {
    if (await exists(path.join(publicDir, relOf(file)))) present.push(file);
    else missing.push(file);
  }
  if (missing.length > 0) {
    states.add("missing-derived");
  }

  const discovered = await discoveredResponsiveFiles(publicDir, binding.basename);
  const expectedSet = new Set(expected);
  const orphan = discovered.filter((file) => !expectedSet.has(file));
  if (orphan.length) states.add("orphan-derived");

  const sourcePath = path.join(publicDir, relOf(`${binding.basename}.png`));
  let sourceDimensions: ResponsiveFamilyAudit["sourceDimensions"] = null;
  let sourceSignature: string | null = null;
  let sourceBuffer: Buffer | null = null;
  try {
    sourceBuffer = await fs.readFile(sourcePath);
    const sourceMeta = await sharp(sourceBuffer).metadata();
    if (sourceMeta.width && sourceMeta.height) {
      sourceDimensions = { width: sourceMeta.width, height: sourceMeta.height };
      sourceSignature = await normalizedVisualSignature(sourceBuffer);
      if (
        sourceMeta.width !== binding.profile.canonical.width
        || sourceMeta.height !== binding.profile.canonical.height
      ) {
        states.add("inconsistent-dimensions");
      }
      if (sourceMeta.width < Math.max(...binding.profile.widths)) {
        states.add("unknown-source");
      }
    } else {
      states.add("unknown-source");
    }
  } catch {
    states.add("unknown-source");
  }

  if (sourceBuffer) {
    for (const file of present) {
      if (file.endsWith(".png")) continue;
      try {
        const buffer = await fs.readFile(path.join(publicDir, relOf(file)));
        const metadata = await sharp(buffer).metadata();
        const widthMatch = file.match(/-(\d+)w\./);
        const expectedWidth = widthMatch
          ? Number(widthMatch[1])
          : binding.profile.canonical.width;
        const expectedHeight = widthMatch
          ? responsiveDerivativeHeight(binding.profile, expectedWidth)
          : binding.profile.canonical.height;
        const extension = path.extname(file).slice(1);
        const expectedFormat = extension === "avif" ? "heif" : extension;
        if (
          metadata.format !== expectedFormat
          || metadata.width !== expectedWidth
          || metadata.height !== expectedHeight
        ) {
          states.add("inconsistent-dimensions");
        }
        const reference = widthMatch
          ? await sharp(sourceBuffer).resize({ width: expectedWidth }).png().toBuffer()
          : sourceBuffer;
        const distance = await normalizedVisualDistance(buffer, reference);
        visualDistances[file] = Number(distance.toFixed(2));
        if (distance > VISUAL_DISTANCE_LIMIT) states.add("stale");
      } catch {
        states.add("inconsistent-dimensions");
      }
    }
  }

  if (states.size === 0) states.add("healthy");
  const stateList = [...states];
  const state = primaryState(stateList);
  return {
    basename: binding.basename,
    slots: binding.slots,
    expected,
    present,
    missing,
    orphan,
    states: stateList,
    state,
    action: recommendedAction(state),
    sourceDimensions,
    sourceSignature,
    visualDistances,
  };
}

export async function auditResponsiveFamilies(
  bindings: readonly ResponsiveFamilyBinding[],
  publicDir = path.join(process.cwd(), "public"),
): Promise<ResponsiveFamilyAudit[]> {
  return Promise.all(bindings.map((binding) => auditResponsiveFamily(binding, publicDir)));
}

export async function discoverResponsiveBasenames(
  publicDir = path.join(process.cwd(), "public"),
): Promise<Map<string, string[]>> {
  const discovered = new Map<string, string[]>();

  async function walk(directory: string): Promise<void> {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute);
        continue;
      }
      const match = entry.name.match(/^(.*)-\d+w\.(?:webp|avif)$/);
      if (!match) continue;
      const relativeDirectory = path.relative(publicDir, directory);
      const basename = `/${path.posix.join(relativeDirectory, match[1])}`;
      const file = `/${path.posix.join(relativeDirectory, entry.name)}`;
      const files = discovered.get(basename) ?? [];
      files.push(file);
      discovered.set(basename, files);
    }
  }

  await walk(publicDir);
  for (const files of discovered.values()) files.sort();
  return discovered;
}
