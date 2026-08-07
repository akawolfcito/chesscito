/**
 * A content seal for "was this `.next` built from THIS source tree?"
 * (spec 2026-08-07-wallet-branch-lazy-load; closes the staleness open question.)
 *
 * ⛔ NOT `mtime`. A `git checkout` rewrites timestamps without changing content,
 * a `touch` changes them without changing anything at all, and a build that runs
 * one second before an edit still looks newer than the file it is missing. The
 * only honest question is whether the bytes that produce the bundle are the same
 * bytes that are on disk now.
 *
 * CommonJS on purpose: `next.config.js` is CJS and requires this at build time
 * to stamp the build. The guard requires the same module afterwards, so both
 * sides compute the fingerprint with ONE implementation — two copies would drift
 * and the seal would fail (or pass) for reasons no one could explain.
 */
const { createHash } = require("node:crypto");
const { readdirSync, readFileSync } = require("node:fs");
const path = require("node:path");

const APP_DIR = path.resolve(__dirname, "../..");
const REPO_ROOT = path.resolve(APP_DIR, "../..");

/** Everything that can change the bytes webpack emits. The lockfile is in here
 *  because a dependency bump changes chunk contents without touching `src/`. */
const TRACKED = [
  { root: APP_DIR, entry: "src" },
  { root: APP_DIR, entry: "next.config.js" },
  { root: APP_DIR, entry: "package.json" },
  { root: REPO_ROOT, entry: "pnpm-lock.yaml" },
];

/** Tests never reach a chunk. Including them would force a 4-minute rebuild
 *  every time a test changes, and the guard would be ignored within a week. */
function isBundled(relativePath) {
  return !/(^|\/)__tests__(\/|$)/.test(relativePath) && !/\.test\.[jt]sx?$/.test(relativePath);
}

function collectFiles(root, entry, out) {
  const absolute = path.join(root, entry);
  let entries;
  try {
    entries = readdirSync(absolute, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOTDIR") {
      out.push({ key: entry, absolute });
      return out;
    }
    if (error.code === "ENOENT") return out;
    throw error;
  }

  for (const dirent of entries) {
    const child = path.posix.join(entry, dirent.name);
    if (dirent.isDirectory()) {
      collectFiles(root, child, out);
    } else if (isBundled(child)) {
      out.push({ key: child, absolute: path.join(root, child) });
    }
  }

  return out;
}

/**
 * Hashes a list of `{ key, content }`. Exported so the hashing itself can be
 * tested without a filesystem: sorting by key is what makes the result
 * independent of directory-read order, which differs between machines.
 */
function fingerprintEntries(entries) {
  const hash = createHash("sha256");
  for (const { key, content } of [...entries].sort((a, b) => (a.key < b.key ? -1 : 1))) {
    // The key is hashed too: moving a file without editing it changes the build.
    hash.update(key);
    hash.update("\0");
    hash.update(content);
    hash.update("\0");
  }
  return hash.digest("hex");
}

/** Walks the tracked sources and returns their fingerprint. */
function computeSourceFingerprint() {
  const entries = [];
  for (const { root, entry } of TRACKED) {
    for (const file of collectFiles(root, entry, [])) {
      entries.push({ key: file.key, content: readFileSync(file.absolute) });
    }
  }
  return { fingerprint: fingerprintEntries(entries), files: entries.length };
}

const STAMP_FILE = "chesscito-source-stamp.json";

module.exports = { computeSourceFingerprint, fingerprintEntries, STAMP_FILE, APP_DIR };
