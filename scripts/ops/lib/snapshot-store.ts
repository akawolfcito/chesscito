/**
 * Snapshot persistence and the comparison between consecutive runs.
 *
 * Artefacts land in `artifacts/ops/` as a timestamped pair plus `latest.*`.
 * They are gitignored: operational data with a cadence of minutes does not
 * belong in history.
 *
 * ── Compatibility ─────────────────────────────────────────────────────────
 *
 * A diff is only offered between snapshots that can legitimately be compared.
 * Two guards:
 *
 *   1. `schema_version` — a snapshot written by a different shape of this tool
 *      is not diffed at all. Silently comparing across a field rename produces
 *      confident nonsense.
 *   2. Per-metric: any side that is `not_observable` yields an incomparable
 *      delta rather than being read as zero (see `lib/derive`).
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/** Bump when the snapshot shape changes in a way that breaks comparison. */
export const SNAPSHOT_SCHEMA_VERSION = 1;

export type SnapshotEnvelope = {
  schema_version: number;
  taken_at_utc: string;
  taken_at_local: string;
  duration_ms: number;
  credentials: Array<{ name: string; configured: boolean }>;
  supabase: unknown;
  vercel: unknown;
  upstash: unknown;
  classification: unknown;
};

/** Filename-safe UTC stamp: `2026-08-04T04-24-25Z`. */
export function snapshotStamp(date: Date): string {
  return `${date.toISOString().slice(0, 19).replace(/:/g, "-")}Z`;
}

export type CompatibilityVerdict =
  | { comparable: true }
  | { comparable: false; reason: string };

/**
 * May these two snapshots be compared at all?
 *
 * Deliberately conservative: an unreadable or differently-versioned previous
 * snapshot yields "no diff" rather than a partial one. A diff that silently
 * skips half its fields is harder to notice than a diff that is absent.
 */
export function checkCompatibility(
  previous: SnapshotEnvelope | null,
  current: SnapshotEnvelope,
): CompatibilityVerdict {
  if (!previous) return { comparable: false, reason: "no previous snapshot" };
  if (previous.schema_version !== current.schema_version) {
    return {
      comparable: false,
      reason:
        `snapshot schema ${previous.schema_version} vs ${current.schema_version} — ` +
        "written by a different version of this tool",
    };
  }
  if (!previous.taken_at_utc || !current.taken_at_utc) {
    return { comparable: false, reason: "a snapshot is missing its timestamp" };
  }
  if (Date.parse(previous.taken_at_utc) >= Date.parse(current.taken_at_utc)) {
    // Clock skew or a re-read of the same file. Either way, not a progression.
    return { comparable: false, reason: "the previous snapshot is not older" };
  }
  return { comparable: true };
}

export type SnapshotPaths = {
  dir: string;
  json: string;
  markdown: string;
  latestJson: string;
  latestMarkdown: string;
};

export function snapshotPaths(repoRoot: string, stamp: string): SnapshotPaths {
  const dir = path.join(repoRoot, "artifacts", "ops");
  return {
    dir,
    json: path.join(dir, `${stamp}.json`),
    markdown: path.join(dir, `${stamp}.md`),
    latestJson: path.join(dir, "latest.json"),
    latestMarkdown: path.join(dir, "latest.md"),
  };
}

/** The previous run, or null. Never throws: a corrupt file is just "no previous". */
export function readLatest(repoRoot: string): SnapshotEnvelope | null {
  try {
    const file = path.join(repoRoot, "artifacts", "ops", "latest.json");
    const parsed = JSON.parse(readFileSync(file, "utf8")) as SnapshotEnvelope;
    return typeof parsed?.schema_version === "number" ? parsed : null;
  } catch {
    return null;
  }
}

export type WrittenArtifacts = { json: string; markdown: string };

export function writeSnapshot(
  repoRoot: string,
  stamp: string,
  envelope: SnapshotEnvelope,
  markdown: string,
): WrittenArtifacts {
  const paths = snapshotPaths(repoRoot, stamp);
  mkdirSync(paths.dir, { recursive: true });

  const json = `${JSON.stringify(envelope, null, 2)}\n`;
  writeFileSync(paths.json, json, "utf8");
  writeFileSync(paths.markdown, markdown, "utf8");
  // `latest.*` is a copy rather than a symlink so the pair survives being
  // copied out of the repo, which is how these get shared.
  writeFileSync(paths.latestJson, json, "utf8");
  writeFileSync(paths.latestMarkdown, markdown, "utf8");

  return { json: paths.json, markdown: paths.markdown };
}

/** Minutes between two snapshots, for labelling the diff. */
export function elapsedMinutes(
  previous: SnapshotEnvelope,
  current: SnapshotEnvelope,
): number {
  return Math.round(
    (Date.parse(current.taken_at_utc) - Date.parse(previous.taken_at_utc)) / 60_000,
  );
}
