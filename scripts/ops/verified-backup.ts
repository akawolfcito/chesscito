/**
 * `pnpm ops:backup:verified` — make a recoverable local snapshot, end to end.
 *
 * The only successful outcome is:
 *   dump created → disposable restore passes → analytics archive passes →
 *   both copies outside the repository compare byte-for-byte.
 *
 * Existing snapshots are never removed. This script deliberately keeps child
 * output private: an error must not turn a production dump path or its content
 * into terminal output.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PRIVATE_ROOT = path.join(REPO_ROOT, "private");
const BACKUPS_ROOT = path.join(PRIVATE_ROOT, "backups");
const ARCHIVE_ROOT = path.join(PRIVATE_ROOT, "archive");
const DEFAULT_EXTERNAL_ROOT = path.join(homedir(), "backups", "chesscito");
const TIMEOUT_MS = 1_800_000;

type SnapshotTree = Map<string, string>;

function externalRoot(): string {
  const target = path.resolve(process.env.CHESSCITO_BACKUP_ROOT || DEFAULT_EXTERNAL_ROOT);
  const relative = path.relative(REPO_ROOT, target);
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    throw new Error("external backup root must be outside the repository");
  }
  return target;
}

function run(args: string[]): void {
  execFileSync("pnpm", args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    timeout: TIMEOUT_MS,
    // The delegated scripts redact failures too, but their output can mention
    // private artefact paths. The operator only needs the step that failed.
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function backupDirectories(): string[] {
  if (!existsSync(BACKUPS_ROOT)) return [];
  return readdirSync(BACKUPS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function newestCreatedBackup(before: readonly string[]): string {
  const prior = new Set(before);
  const created = backupDirectories().filter((name) => !prior.has(name));
  if (created.length !== 1) {
    throw new Error("backup creation did not produce exactly one new snapshot");
  }
  return path.join(BACKUPS_ROOT, created[0]!);
}

function digestTree(root: string): SnapshotTree {
  const out: SnapshotTree = new Map();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const relative = path.relative(root, full);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        out.set(relative, createHash("sha256").update(readFileSync(full)).digest("hex"));
      } else {
        throw new Error("snapshot contains an unsupported filesystem entry");
      }
    }
  };
  walk(root);
  return out;
}

function assertSameTree(source: string, destination: string): void {
  const a = digestTree(source);
  const b = digestTree(destination);
  if (a.size !== b.size) throw new Error("external snapshot file count differs");
  for (const [file, digest] of a) {
    if (b.get(file) !== digest) throw new Error("external snapshot checksum differs");
  }
}

function copySnapshot(source: string, destination: string): void {
  if (existsSync(destination)) throw new Error("refusing to overwrite an existing external snapshot");
  mkdirSync(path.dirname(destination), { recursive: true });
  cpSync(source, destination, { recursive: true, errorOnExist: true });
  assertSameTree(source, destination);
}

function stamp(directory: string): string {
  const name = path.basename(directory);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z$/.test(name)) {
    throw new Error("new backup has an invalid snapshot name");
  }
  return name;
}

function main(): number {
  let step = "create product-state backup";
  try {
    const before = backupDirectories();
    run(["-C", "apps/web", "exec", "tsx", "../../scripts/ops/backup.ts"]);
    const backup = newestCreatedBackup(before);

    step = "verify product-state restore";
    run(["-C", "apps/web", "exec", "tsx", "../../scripts/ops/backup.ts", "--verify", backup]);

    step = "refresh analytics archive";
    run(["-C", "apps/web", "exec", "tsx", "../../scripts/ops/archive.ts", "--all"]);

    step = "verify analytics archive";
    run(["-C", "apps/web", "exec", "tsx", "../../scripts/ops/archive.ts", "--verify-only", "private/archive/manifest.json"]);

    const root = externalRoot();
    const snapshot = stamp(backup);
    step = "mirror product-state backup";
    copySnapshot(backup, path.join(root, "product-state", snapshot));
    step = "mirror analytics archive";
    copySnapshot(ARCHIVE_ROOT, path.join(root, "analytics", snapshot));

    console.log("PRODUCT STATE  verified and mirrored");
    console.log("ANALYTICS      verified and mirrored");
    console.log("RESULT         PASS — local external snapshot is complete");
    return 0;
  } catch {
    console.error(`RESULT         FAIL — ${step}; existing snapshots were not removed`);
    return 1;
  }
}

// Let stdout/stderr flush. `process.exit()` can discard the final verdict when
// this command is run through pnpm with piped output.
process.exitCode = main();
