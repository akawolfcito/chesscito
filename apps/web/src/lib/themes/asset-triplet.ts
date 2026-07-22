import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

import {
  responsiveDerivativeHeight,
  type ResponsiveAssetProfile,
} from "./responsive-asset-profiles";
import type { SingleFileFormat } from "./theme-registry";
import {
  normalizedVisualDistance,
  normalizedVisualSignature,
} from "./asset-family-visual";

export {
  normalizedVisualDistance,
  normalizedVisualSignature,
} from "./asset-family-visual";

const CANONICAL_EXTENSIONS = ["png", "webp", "avif"] as const;
const RESPONSIVE_EXTENSIONS = ["webp", "avif"] as const;
const BACKUP_META_SUFFIX = ".theme-builder-backup.json";
const FAMILY_UNDO_VERSION = 2;
const VISUAL_DISTANCE_LIMIT = 18;

export type AssetFamilyErrorCode =
  | "invalid-image"
  | "source-too-small"
  | "generation-failed"
  | "validation-failed"
  | "registry-failed"
  | "metadata-failed"
  | "write-failed"
  | "rollback-failed"
  | "undo-missing"
  | "undo-failed";

export class AssetFamilyError extends Error {
  constructor(
    public readonly code: AssetFamilyErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message);
    this.name = "AssetFamilyError";
    if (options && "cause" in options) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

export type AssetFamilyResult = {
  files: string[];
  width: number;
  height: number;
  responsiveWidths: number[];
  sourceSignature: string;
};

/** Backward-compatible response name for callers that only use a triplet. */
export type TripletResult = AssetFamilyResult;

export type AssetFamilyTransactionHooks = {
  beforePromoteMember?: (index: number, file: string) => void | Promise<void>;
  beforeUndoInstall?: () => void | Promise<void>;
  beforeRestoreMember?: (index: number, file: string) => void | Promise<void>;
};

type FamilyMember = {
  suffix: string;
  url: string;
  extension: "png" | "webp" | "avif" | "jpg";
  width: number;
  height: number;
  buffer: Buffer;
};

type UndoMember = {
  suffix: string;
  existed: boolean;
  backupFile: string | null;
};

type FamilyUndoManifest = {
  version: typeof FAMILY_UNDO_VERSION;
  basename: string;
  members: UndoMember[];
};

type ReplaceOptions = {
  basename: string;
  input: Buffer;
  profile?: ResponsiveAssetProfile | null;
  rootDir?: string;
  /** Write ONE file with this extension instead of the triplet. */
  format?: SingleFileFormat;
  /** Reject a source that is not exactly this size. */
  exactSize?: { width: number; height: number } | null;
  afterPromote?: () => Promise<void>;
  rollbackAfterPromote?: () => Promise<void>;
  persistUndoState?: () => Promise<void>;
  hooks?: AssetFamilyTransactionHooks;
};

type RestoreOptions = {
  basename: string;
  profile?: ResponsiveAssetProfile | null;
  rootDir?: string;
  afterRestore?: () => Promise<void>;
  rollbackAfterRestore?: () => Promise<void>;
  hooks?: AssetFamilyTransactionHooks;
};

const familyQueues = new Map<string, Promise<unknown>>();

async function withFamilyLock<T>(
  basename: string,
  rootDir: string | undefined,
  operation: () => Promise<T>,
): Promise<T> {
  const key = `${path.resolve(rootDir ?? process.cwd())}::${basename}`;
  const previous = familyQueues.get(key) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  familyQueues.set(key, current);
  try {
    return await current;
  } finally {
    if (familyQueues.get(key) === current) familyQueues.delete(key);
  }
}

function roots(rootDir = process.cwd()) {
  const trash = path.join(rootDir, ".theme-builder-trash");
  return {
    publicDir: path.join(rootDir, "public"),
    trashDir: trash,
    familyUndoRoot: path.join(trash, "families"),
    transactionRoot: path.join(trash, "transactions"),
  };
}

function relOf(value: string): string {
  return value.replace(/^\/+/, "");
}

function familyUndoDir(rootDir: string | undefined, basename: string): string {
  return path.join(roots(rootDir).familyUndoRoot, relOf(basename));
}

async function exists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

function expectedSharpFormat(extension: FamilyMember["extension"]): string {
  if (extension === "avif") return "heif";
  if (extension === "jpg") return "jpeg";
  return extension;
}

function isSafeFamilySuffix(value: unknown): value is string {
  return typeof value === "string"
    && /^(?:\.(?:png|webp|avif|jpg)|-\d+w\.(?:webp|avif))$/.test(value);
}

function stubMember(basename: string, suffix: string): FamilyMember {
  const extension = suffix.endsWith(".avif")
    ? "avif"
    : suffix.endsWith(".webp")
      ? "webp"
      : suffix.endsWith(".jpg")
        ? "jpg"
        : "png";
  return {
    suffix,
    url: `${basename}${suffix}`,
    extension,
    width: 0,
    height: 0,
    buffer: Buffer.alloc(0),
  };
}

async function discoverExistingFamilyMembers(
  publicDir: string,
  basename: string,
): Promise<FamilyMember[]> {
  const relative = relOf(basename);
  const directory = path.join(publicDir, path.dirname(relative));
  const stem = path.basename(relative).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let names: string[];
  try {
    names = await fs.readdir(directory);
  } catch {
    return [];
  }
  const pattern = new RegExp(`^${stem}((?:\\.(?:png|webp|avif|jpg))|(?:-\\d+w\\.(?:webp|avif)))$`);
  return names.flatMap((name) => {
    const match = name.match(pattern);
    return match ? [stubMember(basename, match[1])] : [];
  });
}

async function validateMember(
  member: FamilyMember,
  reference: Buffer,
  requireAlpha = true,
): Promise<void> {
  let metadata: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    metadata = await sharp(member.buffer).metadata();
  } catch (error) {
    throw new AssetFamilyError(
      "validation-failed",
      `generated ${member.url} could not be decoded`,
      { cause: error },
    );
  }
  if (
    metadata.format !== expectedSharpFormat(member.extension)
    || metadata.width !== member.width
    || metadata.height !== member.height
  ) {
    throw new AssetFamilyError(
      "validation-failed",
      `generated ${member.url} has unexpected format or dimensions`,
    );
  }
  if (requireAlpha && !metadata.hasAlpha) {
    throw new AssetFamilyError(
      "validation-failed",
      `generated ${member.url} lost its alpha channel`,
    );
  }
  const distance = await normalizedVisualDistance(member.buffer, reference);
  if (distance > VISUAL_DISTANCE_LIMIT) {
    throw new AssetFamilyError(
      "validation-failed",
      `generated ${member.url} does not match the canonical source`,
    );
  }
}

async function canonicalize(
  input: Buffer,
  profile: ResponsiveAssetProfile | null,
): Promise<{ png: Buffer; width: number; height: number }> {
  let oriented: Buffer;
  let metadata: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    oriented = await sharp(input).rotate().png().toBuffer();
    metadata = await sharp(oriented).metadata();
  } catch (error) {
    throw new AssetFamilyError(
      "invalid-image",
      "could not decode the uploaded image",
      { cause: error },
    );
  }
  if (!metadata.width || !metadata.height) {
    throw new AssetFamilyError("invalid-image", "uploaded image has no dimensions");
  }

  if (!profile) {
    return {
      png: await sharp(oriented)
        .ensureAlpha()
        .png({ palette: true, quality: 80, effort: 10, compressionLevel: 9 })
        .toBuffer(),
      width: metadata.width,
      height: metadata.height,
    };
  }

  const largestWidth = Math.max(...profile.widths);
  if (metadata.width < profile.canonical.width || metadata.width < largestWidth) {
    throw new AssetFamilyError(
      "source-too-small",
      `source width ${metadata.width}px is smaller than required ${largestWidth}px`,
    );
  }

  const contained = await sharp(oriented)
    .resize({
      width: profile.canonical.width,
      height: profile.canonical.height,
      fit: "inside",
      withoutEnlargement: true,
    })
    .ensureAlpha()
    .png()
    .toBuffer();
  const containedMeta = await sharp(contained).metadata();
  const containedWidth = containedMeta.width ?? 0;
  const containedHeight = containedMeta.height ?? 0;
  const left = Math.floor((profile.canonical.width - containedWidth) / 2);
  const top = Math.floor((profile.canonical.height - containedHeight) / 2);

  const png = await sharp({
    create: {
      width: profile.canonical.width,
      height: profile.canonical.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: contained, left, top }])
    .png({ palette: true, quality: 80, effort: 10, compressionLevel: 9 })
    .toBuffer();

  return {
    png,
    width: profile.canonical.width,
    height: profile.canonical.height,
  };
}

async function buildFamily(
  basename: string,
  input: Buffer,
  profile: ResponsiveAssetProfile | null,
  options?: {
    format?: SingleFileFormat;
    exactSize?: { width: number; height: number } | null;
  },
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
    let jpg: Buffer;
    try {
      jpg = await sharp(canonical.png)
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .jpeg({ quality: 88, mozjpeg: true })
        .toBuffer();
    } catch (error) {
      throw new AssetFamilyError(
        "generation-failed",
        "the jpeg could not be generated",
        { cause: error },
      );
    }
    const member: FamilyMember = {
      suffix: ".jpg",
      url: `${basename}.jpg`,
      extension: "jpg",
      width: canonical.width,
      height: canonical.height,
      buffer: jpg,
    };
    // No alpha to require — the flatten above just removed it on purpose.
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

  try {
    const canonicalBuffers = {
      png: canonical.png,
      webp: await sharp(canonical.png).webp({ quality: 80, effort: 6 }).toBuffer(),
      avif: await sharp(canonical.png).avif({ quality: 50, effort: 4 }).toBuffer(),
    };
    for (const extension of CANONICAL_EXTENSIONS) {
      members.push({
        suffix: `.${extension}`,
        url: `${basename}.${extension}`,
        extension,
        width: canonical.width,
        height: canonical.height,
        buffer: canonicalBuffers[extension],
      });
    }

    for (const width of profile?.widths ?? []) {
      const height = responsiveDerivativeHeight(profile!, width);
      const resized = await sharp(canonical.png).resize({ width }).png().toBuffer();
      const buffers = {
        webp: await sharp(resized).webp({ quality: 80, effort: 6 }).toBuffer(),
        avif: await sharp(resized).avif({ quality: 50, effort: 4 }).toBuffer(),
      };
      for (const extension of RESPONSIVE_EXTENSIONS) {
        members.push({
          suffix: `-${width}w.${extension}`,
          url: `${basename}-${width}w.${extension}`,
          extension,
          width,
          height,
          buffer: buffers[extension],
        });
      }
    }
  } catch (error) {
    if (error instanceof AssetFamilyError) throw error;
    throw new AssetFamilyError(
      "generation-failed",
      "one or more image variants could not be generated",
      { cause: error },
    );
  }

  for (const member of members) {
    const reference = member.width === canonical.width
      ? canonical.png
      : await sharp(canonical.png).resize({ width: member.width }).png().toBuffer();
    await validateMember(member, reference, Boolean(profile));
  }

  return {
    members,
    result: {
      files: members.map((member) => member.url),
      width: canonical.width,
      height: canonical.height,
      responsiveWidths: [...(profile?.widths ?? [])],
      sourceSignature: await normalizedVisualSignature(canonical.png),
    },
  };
}

async function atomicCopy(source: string, destination: string): Promise<void> {
  await fs.mkdir(path.dirname(destination), { recursive: true });
  const temp = `${destination}.theme-builder-${randomUUID()}.tmp`;
  try {
    await fs.copyFile(source, temp);
    await fs.rename(temp, destination);
  } finally {
    await fs.rm(temp, { force: true });
  }
}

async function atomicWriteBuffer(buffer: Buffer, destination: string): Promise<void> {
  await fs.mkdir(path.dirname(destination), { recursive: true });
  const temp = `${destination}.theme-builder-${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temp, buffer);
    await fs.rename(temp, destination);
  } finally {
    await fs.rm(temp, { force: true }).catch(() => undefined);
  }
}

async function snapshotPublicFamily(
  members: FamilyMember[],
  publicDir: string,
  snapshotDir: string,
): Promise<FamilyUndoManifest> {
  const undoMembers: UndoMember[] = [];
  await fs.mkdir(path.join(snapshotDir, "files"), { recursive: true });
  for (const [index, member] of members.entries()) {
    const source = path.join(publicDir, relOf(member.url));
    const existed = await exists(source);
    const backupFile = existed ? `files/${index}${member.suffix}` : null;
    if (backupFile) {
      await fs.copyFile(source, path.join(snapshotDir, backupFile));
    }
    undoMembers.push({ suffix: member.suffix, existed, backupFile });
  }
  const manifest: FamilyUndoManifest = {
    version: FAMILY_UNDO_VERSION,
    basename: members[0]?.url.replace(members[0].suffix, "") ?? "",
    members: undoMembers,
  };
  await fs.writeFile(
    path.join(snapshotDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );
  return manifest;
}

async function restoreSnapshot(
  manifest: FamilyUndoManifest,
  snapshotDir: string,
  publicDir: string,
): Promise<string[]> {
  const restored: string[] = [];
  for (const member of manifest.members) {
    const url = `${manifest.basename}${member.suffix}`;
    const destination = path.join(publicDir, relOf(url));
    if (member.existed && member.backupFile) {
      await atomicCopy(path.join(snapshotDir, member.backupFile), destination);
    } else {
      await fs.rm(destination, { force: true });
    }
    restored.push(url);
  }
  return restored;
}

async function validatePublicMembers(
  members: FamilyMember[],
  publicDir: string,
  requireAlpha: boolean,
): Promise<void> {
  for (const member of members) {
    const buffer = await fs.readFile(path.join(publicDir, relOf(member.url)));
    const reference = member.width === members[0].width
      ? members[0].buffer
      : await sharp(members[0].buffer).resize({ width: member.width }).png().toBuffer();
    await validateMember({ ...member, buffer }, reference, requireAlpha);
  }
}

/**
 * Generate, validate, promote, and snapshot an entire asset family. Public
 * files, downstream registry state, and the prior undo snapshot are restored
 * if any step after preparation fails.
 */
async function replaceAssetFamilyAtomicUnlocked(
  options: ReplaceOptions,
): Promise<AssetFamilyResult> {
  const profile = options.profile ?? null;
  const generated = await buildFamily(options.basename, options.input, profile, {
    format: options.format,
    exactSize: options.exactSize ?? null,
  });
  const resolvedRoots = roots(options.rootDir);
  const transactionDir = path.join(resolvedRoots.transactionRoot, randomUUID());
  const stagedNewDir = path.join(transactionDir, "new");
  const priorPublicDir = path.join(transactionDir, "prior-public");
  const undoCandidateDir = path.join(transactionDir, "undo-candidate");
  const previousUndoDir = path.join(transactionDir, "previous-undo");
  const undoDestination = familyUndoDir(options.rootDir, options.basename);
  let publicPromoted = false;
  let downstreamAttempted = false;
  let undoInstalled = false;
  let previousUndoMoved = false;
  let priorManifest: FamilyUndoManifest | null = null;

  await fs.mkdir(stagedNewDir, { recursive: true });
  try {
    for (const [index, member] of generated.members.entries()) {
      await fs.writeFile(path.join(stagedNewDir, `${index}${member.suffix}`), member.buffer);
    }
    const generatedSuffixes = new Set(generated.members.map((member) => member.suffix));
    const obsoleteMembers = (await discoverExistingFamilyMembers(
      resolvedRoots.publicDir,
      options.basename,
    )).filter((member) => !generatedSuffixes.has(member.suffix));
    const transactionMembers = [...generated.members, ...obsoleteMembers];
    priorManifest = await snapshotPublicFamily(
      transactionMembers,
      resolvedRoots.publicDir,
      priorPublicDir,
    );
    await fs.cp(priorPublicDir, undoCandidateDir, { recursive: true });

    publicPromoted = true;
    for (const [index, member] of generated.members.entries()) {
      await options.hooks?.beforePromoteMember?.(index, member.url);
      const destination = path.join(resolvedRoots.publicDir, relOf(member.url));
      await atomicCopy(path.join(stagedNewDir, `${index}${member.suffix}`), destination);
    }
    for (const member of obsoleteMembers) {
      await fs.rm(path.join(resolvedRoots.publicDir, relOf(member.url)), { force: true });
    }
    await validatePublicMembers(
      generated.members,
      resolvedRoots.publicDir,
      Boolean(profile),
    );

    if (options.afterPromote) {
      downstreamAttempted = true;
      try {
        await options.afterPromote();
      } catch (error) {
        throw new AssetFamilyError(
          "registry-failed",
          "theme registry could not be updated",
          { cause: error },
        );
      }
    }

    await options.hooks?.beforeUndoInstall?.();
    await fs.mkdir(path.dirname(undoDestination), { recursive: true });
    if (await exists(undoDestination)) {
      await fs.rename(undoDestination, previousUndoDir);
      previousUndoMoved = true;
    }
    try {
      await fs.rename(undoCandidateDir, undoDestination);
      undoInstalled = true;
    } catch (error) {
      if (previousUndoMoved) {
        await fs.rename(previousUndoDir, undoDestination);
        previousUndoMoved = false;
      }
      throw error;
    }

    if (options.persistUndoState) {
      try {
        await options.persistUndoState();
      } catch (error) {
        throw new AssetFamilyError(
          "metadata-failed",
          "asset family undo metadata could not be persisted",
          { cause: error },
        );
      }
    }
    // Cleanup is outside the logical commit. A transient cleanup failure must
    // not roll back a family after public files, registry, and undo metadata
    // have all been committed successfully.
    await fs.rm(transactionDir, { recursive: true, force: true }).catch(() => undefined);
    return generated.result;
  } catch (error) {
    const rollbackErrors: unknown[] = [];
    try {
      if (undoInstalled) {
        await fs.rm(undoDestination, { recursive: true, force: true });
        if (previousUndoMoved && await exists(previousUndoDir)) {
          await fs.mkdir(path.dirname(undoDestination), { recursive: true });
          await fs.rename(previousUndoDir, undoDestination);
          previousUndoMoved = false;
        }
      }
    } catch (rollbackError) {
      rollbackErrors.push(rollbackError);
    }
    if (downstreamAttempted && options.rollbackAfterPromote) {
      try {
        await options.rollbackAfterPromote();
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    if (publicPromoted && priorManifest) {
      try {
        await restoreSnapshot(priorManifest, priorPublicDir, resolvedRoots.publicDir);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    await fs.rm(transactionDir, { recursive: true, force: true }).catch(() => undefined);
    if (rollbackErrors.length > 0) {
      throw new AssetFamilyError(
        "rollback-failed",
        "asset family update failed and rollback could not be completed",
        { cause: rollbackErrors[0] },
      );
    }
    if (error instanceof AssetFamilyError) throw error;
    throw new AssetFamilyError(
      "write-failed",
      "asset family could not be promoted atomically",
      { cause: error },
    );
  }
}

export function replaceAssetFamilyAtomic(
  options: ReplaceOptions,
): Promise<AssetFamilyResult> {
  return withFamilyLock(options.basename, options.rootDir, () =>
    replaceAssetFamilyAtomicUnlocked(options));
}

async function readFamilyUndo(
  rootDir: string | undefined,
  basename: string,
): Promise<{ dir: string; manifest: FamilyUndoManifest } | null> {
  const dir = familyUndoDir(rootDir, basename);
  try {
    const manifest = JSON.parse(
      await fs.readFile(path.join(dir, "manifest.json"), "utf8"),
    ) as FamilyUndoManifest;
    const suffixes = new Set<string>();
    const membersAreSafe = Array.isArray(manifest.members)
      && manifest.members.every((member, index) => {
        if (
          !member
          || typeof member !== "object"
          || !isSafeFamilySuffix(member.suffix)
          || typeof member.existed !== "boolean"
          || suffixes.has(member.suffix)
        ) {
          return false;
        }
        suffixes.add(member.suffix);
        const expectedBackup = member.existed
          ? `files/${index}${member.suffix}`
          : null;
        return member.backupFile === expectedBackup;
      });
    if (
      manifest.version !== FAMILY_UNDO_VERSION
      || manifest.basename !== basename
      || !membersAreSafe
    ) {
      return null;
    }
    return { dir, manifest };
  } catch {
    return null;
  }
}

async function restoreLegacyTripletAtomic(
  options: RestoreOptions,
): Promise<{ ok: boolean; restored: string[] }> {
  const resolvedRoots = roots(options.rootDir);
  const rel = relOf(options.basename);
  let priorFormats: string[] | null = null;
  try {
    const meta = JSON.parse(
      await fs.readFile(path.join(resolvedRoots.trashDir, `${rel}${BACKUP_META_SUFFIX}`), "utf8"),
    ) as { existing?: string[] };
    priorFormats = Array.isArray(meta.existing) ? meta.existing : [];
  } catch {
    // Backups created before family snapshots only contain copied siblings.
  }
  const legacyBackups = new Map<string, string>();
  for (const extension of CANONICAL_EXTENSIONS) {
    const backup = path.join(resolvedRoots.trashDir, `${rel}.${extension}`);
    if (await exists(backup)) legacyBackups.set(extension, backup);
  }
  if (priorFormats === null && legacyBackups.size === 0) {
    return { ok: false, restored: [] };
  }

  let responsiveMembers: FamilyMember[] = [];
  const pngBackup = legacyBackups.get("png");
  if (options.profile && pngBackup) {
    try {
      const generated = await buildFamily(
        options.basename,
        await fs.readFile(pngBackup),
        options.profile,
      );
      responsiveMembers = generated.members.filter((member) => member.suffix.startsWith("-"));
    } catch (error) {
      throw new AssetFamilyError(
        "undo-failed",
        "legacy backup could not regenerate its responsive derivatives",
        { cause: error },
      );
    }
  } else if (options.profile && priorFormats !== null && !priorFormats.includes("png")) {
    responsiveMembers = options.profile.widths.flatMap((width) =>
      RESPONSIVE_EXTENSIONS.map((extension) =>
        stubMember(options.basename, `-${width}w.${extension}`)));
  }

  const transactionDir = path.join(resolvedRoots.transactionRoot, randomUUID());
  const currentSnapshotDir = path.join(transactionDir, "current-public");
  const canonicalMembers = CANONICAL_EXTENSIONS.map((extension) =>
    stubMember(options.basename, `.${extension}`));
  const transactionMembers = [...canonicalMembers, ...responsiveMembers];
  const currentManifest = await snapshotPublicFamily(
    transactionMembers,
    resolvedRoots.publicDir,
    currentSnapshotDir,
  );
  let publicAttempted = false;
  let downstreamAttempted = false;
  const restored: string[] = [];

  try {
    publicAttempted = true;
    for (const extension of CANONICAL_EXTENSIONS) {
      const backup = legacyBackups.get(extension);
      const destination = path.join(resolvedRoots.publicDir, `${rel}.${extension}`);
      if (priorFormats && !priorFormats.includes(extension)) {
        await fs.rm(destination, { force: true });
        restored.push(`${options.basename}.${extension}`);
      } else if (backup) {
        await atomicCopy(backup, destination);
        restored.push(`${options.basename}.${extension}`);
      }
    }
    for (const member of responsiveMembers) {
      const destination = path.join(resolvedRoots.publicDir, relOf(member.url));
      if (member.buffer.length > 0) {
        await atomicWriteBuffer(member.buffer, destination);
      } else {
        await fs.rm(destination, { force: true });
      }
      restored.push(member.url);
    }
    if (options.afterRestore) {
      downstreamAttempted = true;
      try {
        await options.afterRestore();
      } catch (error) {
        throw new AssetFamilyError(
          "registry-failed",
          "theme registry could not be restored during undo",
          { cause: error },
        );
      }
    }
    await fs.rm(transactionDir, { recursive: true, force: true }).catch(() => undefined);
    return { ok: true, restored };
  } catch (error) {
    const rollbackErrors: unknown[] = [];
    if (downstreamAttempted && options.rollbackAfterRestore) {
      try {
        await options.rollbackAfterRestore();
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    if (publicAttempted) {
      try {
        await restoreSnapshot(currentManifest, currentSnapshotDir, resolvedRoots.publicDir);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    await fs.rm(transactionDir, { recursive: true, force: true }).catch(() => undefined);
    if (rollbackErrors.length > 0) {
      throw new AssetFamilyError(
        "rollback-failed",
        "legacy family undo failed and rollback could not be completed",
        { cause: rollbackErrors[0] },
      );
    }
    if (error instanceof AssetFamilyError) throw error;
    throw new AssetFamilyError(
      "undo-failed",
      "legacy asset family could not be restored atomically",
      { cause: error },
    );
  }
}

async function restorePreviousAssetFamilyAtomicUnlocked(
  options: RestoreOptions,
): Promise<{ ok: boolean; restored: string[] }> {
  const undo = await readFamilyUndo(options.rootDir, options.basename);
  if (!undo) {
    return restoreLegacyTripletAtomic(options);
  }

  const resolvedRoots = roots(options.rootDir);
  const transactionDir = path.join(resolvedRoots.transactionRoot, randomUUID());
  const currentSnapshotDir = path.join(transactionDir, "current-public");
  const currentMembers: FamilyMember[] = [];
  for (const member of undo.manifest.members) {
    const url = `${options.basename}${member.suffix}`;
    const extension = member.suffix.endsWith(".avif")
      ? "avif"
      : member.suffix.endsWith(".webp")
        ? "webp"
        : "png";
    currentMembers.push({
      suffix: member.suffix,
      url,
      extension,
      width: 0,
      height: 0,
      buffer: Buffer.alloc(0),
    });
  }
  const currentManifest = await snapshotPublicFamily(
    currentMembers,
    resolvedRoots.publicDir,
    currentSnapshotDir,
  );
  let publicRestored = false;
  let downstreamRestored = false;

  try {
    const restored: string[] = [];
    publicRestored = true;
    for (const [index, member] of undo.manifest.members.entries()) {
      const url = `${options.basename}${member.suffix}`;
      await options.hooks?.beforeRestoreMember?.(index, url);
      const destination = path.join(resolvedRoots.publicDir, relOf(url));
      if (member.existed && member.backupFile) {
        await atomicCopy(path.join(undo.dir, member.backupFile), destination);
      } else {
        await fs.rm(destination, { force: true });
      }
      restored.push(url);
    }
    downstreamRestored = Boolean(options.afterRestore);
    await options.afterRestore?.();
    await fs.rm(transactionDir, { recursive: true, force: true }).catch(() => undefined);
    return { ok: true, restored };
  } catch (error) {
    const rollbackErrors: unknown[] = [];
    try {
      if (downstreamRestored) await options.rollbackAfterRestore?.();
    } catch (rollbackError) {
      rollbackErrors.push(rollbackError);
    }
    try {
      if (publicRestored) await restoreSnapshot(currentManifest, currentSnapshotDir, resolvedRoots.publicDir);
    } catch (rollbackError) {
      rollbackErrors.push(rollbackError);
    }
    try {
      await fs.rm(transactionDir, { recursive: true, force: true });
    } catch (cleanupError) {
      rollbackErrors.push(cleanupError);
    }
    if (rollbackErrors.length > 0) {
      throw new AssetFamilyError(
        "rollback-failed",
        "asset family undo failed and rollback could not be completed",
        { cause: rollbackErrors[0] },
      );
    }
    throw new AssetFamilyError(
      "undo-failed",
      "asset family could not be restored atomically",
      { cause: error },
    );
  }
}

export function restorePreviousAssetFamilyAtomic(
  options: RestoreOptions,
): Promise<{ ok: boolean; restored: string[] }> {
  return withFamilyLock(options.basename, options.rootDir, () =>
    restorePreviousAssetFamilyAtomicUnlocked(options));
}

/** True when a complete family snapshot or a legacy triplet backup exists. */
export async function hasBackup(
  basename: string,
  rootDir?: string,
): Promise<boolean> {
  if (await readFamilyUndo(rootDir, basename)) return true;
  const resolvedRoots = roots(rootDir);
  const rel = relOf(basename);
  if (await exists(path.join(resolvedRoots.trashDir, `${rel}${BACKUP_META_SUFFIX}`))) {
    return true;
  }
  for (const extension of CANONICAL_EXTENSIONS) {
    if (await exists(path.join(resolvedRoots.trashDir, `${rel}.${extension}`))) {
      return true;
    }
  }
  return false;
}

/** Compatibility wrapper for non-responsive callers. */
export function writeAssetTriplet(
  basename: string,
  input: Buffer,
): Promise<AssetFamilyResult> {
  return replaceAssetFamilyAtomic({ basename, input });
}

/** Compatibility wrapper for backups created before complete families. */
export function restorePreviousTriplet(
  basename: string,
): Promise<{ ok: boolean; restored: string[] }> {
  return restorePreviousAssetFamilyAtomic({ basename });
}
