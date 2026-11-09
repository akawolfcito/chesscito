/**
 * The bundle guard's brain (spec 2026-08-07-wallet-branch-lazy-load, AC9–AC14).
 *
 * It answers ONE question: does the JavaScript a MiniPay player receives
 * statically — before any `import()` — contain code that only the Privy branch
 * can use? MiniPay is the surface this optimisation exists for; the web branch
 * is out of scope by decision (founder, 2026-08-07).
 *
 * ⚠️ IT LOOKS FOR LIVE CODE, NEVER FOR NAMES. Searching for module names, file
 * names or component names gives false positives — EXP1 measured `"hub-tour"`
 * appearing in the PAGE entry even though its chunk is deferred, because the
 * string lives in a static chunk. And searching for an exported sentinel
 * constant gives the opposite failure: nobody imports it, Terser deletes it, and
 * the guard passes BY ABSENCE. Both are tests that fail towards green.
 *
 * What it searches for instead is code the branch cannot run without:
 *   1. the `data-wallet-branch="privy"` attribute the branch RENDERS, and
 *   2. `@privy-io` package paths, as cross-confirmation.
 */

/** The shape of `.next/app-build-manifest.json` that matters here. */
export type BuildManifest = { pages: Record<string, string[]> };

export type PrivyEvidenceKind = "branch-marker" | "privy-package";

export type PrivyEvidence = {
  kind: PrivyEvidenceKind;
  /** The exact text matched, so a failure report can be audited instead of
   *  believed. */
  match: string;
};

export type GraphFinding = PrivyEvidence & { file: string };

export type GraphVerdict = {
  /** How many chunk files were actually read. Reported so "no findings" can be
   *  distinguished from "nothing was looked at". */
  inspected: number;
  findings: GraphFinding[];
  ok: boolean;
};

/**
 * The attribute as the MINIFIER emits it: a JSX prop becomes an object key, so
 * the real bytes are `"data-wallet-branch":"privy"`. Quote style and whitespace
 * are tolerated because they are the minifier's choice, not ours; the pairing of
 * the two literals is what makes this evidence.
 */
const BRANCH_MARKER = /["']data-wallet-branch["']\s*:\s*["']privy["']/;

/** Bundled Privy package code. A module path only appears in a chunk when the
 *  module is IN it — an async reference compiles to a numeric chunk id. */
const PRIVY_PACKAGE = /@privy-io\/[a-z-]+/;

/** Returns the first piece of Privy evidence in a chunk's source, or null.
 *  ⛔ The bare word "privy" is NOT evidence: a variable called `privyEnabled`
 *  lives in the boundary, which every route legitimately ships. */
export function findPrivyEvidence(source: string): PrivyEvidence | null {
  const marker = source.match(BRANCH_MARKER);
  if (marker) {
    return { kind: "branch-marker", match: marker[0] };
  }

  const pkg = source.match(PRIVY_PACKAGE);
  if (pkg) {
    return { kind: "privy-package", match: pkg[0] };
  }

  return null;
}

/**
 * Every JS chunk a MiniPay player receives statically.
 *
 * All `/[locale]` entries, not just the hub: a player walks to `/exercises` and
 * `/arena` too, and a leak there is the same leak. `/dev/**` is excluded on
 * purpose — those routes import `WalletProvider` directly (E6), they are their
 * own entries outside the shared layout, and no player reaches them.
 */
export function collectMiniPayGraph(manifest: BuildManifest): string[] {
  const files = new Set<string>();

  for (const [route, entries] of Object.entries(manifest.pages)) {
    if (!route.startsWith("/[locale]")) continue;
    for (const file of entries) {
      if (file.endsWith(".js")) files.add(file);
    }
  }

  return [...files];
}

/**
 * Reads every chunk in the MiniPay graph and reports Privy evidence.
 *
 * ⛔ An empty graph is NOT a pass. Zero findings over zero files means the
 * manifest is not what we think it is — a renamed route, a moved manifest, a
 * build that never ran — and reporting that as success is exactly how a guard
 * ends up protecting nothing while looking green.
 */
export function auditMiniPayGraph({
  manifest,
  readChunk,
}: {
  manifest: BuildManifest;
  readChunk: (file: string) => string;
}): GraphVerdict {
  const files = collectMiniPayGraph(manifest);
  const findings: GraphFinding[] = [];

  for (const file of files) {
    const evidence = findPrivyEvidence(readChunk(file));
    if (evidence) findings.push({ file, ...evidence });
  }

  return {
    inspected: files.length,
    findings,
    ok: files.length > 0 && findings.length === 0,
  };
}
