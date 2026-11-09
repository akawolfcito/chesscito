/**
 * `pnpm bundle:guard` — AC9–AC14 of docs/specs/2026-08-07-wallet-branch-lazy-load.md.
 *
 * Proves, from the build itself, that the JavaScript a MiniPay player receives
 * statically carries no Privy-only code.
 *
 * ⚠️ THIS IS NOT A `*.test.ts` ON PURPOSE. vitest's include globs cover
 * `scripts/**​/__tests__/**`, and a guard collected by `pnpm test` would run
 * against whatever `.next` happened to be lying around — passing green about a
 * build from three days ago. Its LOGIC is unit-tested in
 * `src/lib/bundle/__tests__/minipay-graph-guard.test.ts`, which needs no build;
 * this file only supplies real inputs and a real exit code.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  auditMiniPayGraph,
  type BuildManifest,
} from "@/lib/bundle/minipay-graph-guard";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { computeSourceFingerprint, STAMP_FILE } = require("./lib/source-fingerprint.cjs");

const APP_DIR = process.cwd();
const NEXT_DIR = path.join(APP_DIR, ".next");

function fail(message: string): never {
  console.error(`\n❌ ${message}\n`);
  process.exit(1);
}

/** The build must come from THIS tree. A guard that audits a stale bundle is
 *  worse than no guard: it reports on code nobody is shipping. */
function requireFreshBuild(): void {
  let stamp: { fingerprint?: string; stampedAt?: string };
  try {
    stamp = JSON.parse(readFileSync(path.join(NEXT_DIR, STAMP_FILE), "utf8"));
  } catch {
    fail(
      `No build seal in .next/${STAMP_FILE}.\n` +
        `   Run \`pnpm -C apps/web build\` and try again.`,
    );
  }

  const { fingerprint } = computeSourceFingerprint();
  if (stamp.fingerprint !== fingerprint) {
    fail(
      `The build in .next was made from DIFFERENT sources than the ones on disk.\n` +
        `   sealed:  ${String(stamp.fingerprint).slice(0, 16)}…  (${stamp.stampedAt})\n` +
        `   current: ${fingerprint.slice(0, 16)}…\n` +
        `   Run \`pnpm -C apps/web build\` and try again.`,
    );
  }
}

function main(): void {
  requireFreshBuild();

  const manifest = JSON.parse(
    readFileSync(path.join(NEXT_DIR, "app-build-manifest.json"), "utf8"),
  ) as BuildManifest;

  const verdict = auditMiniPayGraph({
    manifest,
    readChunk: (file) => {
      try {
        return readFileSync(path.join(NEXT_DIR, file), "utf8");
      } catch {
        // A manifest entry with no file on disk is a broken build, not a pass.
        fail(`Manifest lists a chunk that is not on disk: ${file}`);
      }
    },
  });

  if (verdict.inspected === 0) {
    fail(
      "No /[locale] entries in app-build-manifest.json — nothing was inspected.\n" +
        "   Zero findings over zero files is not a pass.",
    );
  }

  if (verdict.findings.length > 0) {
    console.error(
      `\n❌ Privy code reached the static graph MiniPay receives ` +
        `(${verdict.findings.length} of ${verdict.inspected} chunks):\n`,
    );
    for (const finding of verdict.findings) {
      console.error(`   ${finding.file}\n     ${finding.kind}: ${finding.match}`);
    }
    console.error(
      "\n   A static import of the Privy branch from anything the layout reaches\n" +
        "   is enough to cause this — check for a re-export or a non-lazy import.\n",
    );
    process.exit(1);
  }

  console.log(
    `\n✅ MiniPay static graph is clean: ${verdict.inspected} JS chunks inspected, ` +
      `no Privy branch marker and no @privy-io code.\n`,
  );
}

main();
