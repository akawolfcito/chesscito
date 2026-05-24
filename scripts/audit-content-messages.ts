/**
 * Chesscito content audit — non-destructive editorial linter.
 *
 * Reads:
 *   apps/web/src/lib/content/editorial.ts
 *   apps/web/src/lib/content/messages/en.ts
 *   apps/web/src/lib/content/messages/es.ts
 *
 * Reports (warn-only, exit 0 always):
 *   1. ES keys not in EN
 *   2. EN keys not overridden in ES
 *   3. Long strings in button-like paths
 *   4. Web3 jargon in user-facing copy
 *   5. Risky cognitive / medical claims
 *   6. Function helpers in editorial.ts missing ICU mirror in en.ts
 *
 * Usage:
 *   pnpm content:audit
 *
 * Limitations (intentional, documented):
 * - Detection #3 (button length) uses path-heuristics ("cta", "button",
 *   "label" in the path) — false positives possible. We err on the side
 *   of MORE warnings to keep the editorial review intentional.
 * - Detection #4 (Web3 jargon) flags ALL string occurrences regardless
 *   of namespace. Docs / legal / advanced surfaces are allowed to use
 *   Web3 vocabulary; reviewer manually clears those entries. We log a
 *   namespace allowlist hint per match so the reviewer can skip
 *   intentional cases fast.
 * - Detection #5 (medical claims) is a curated keyword list, not
 *   semantic. Inversions ("does not prevent Alzheimer") are still
 *   flagged so the reviewer can confirm the framing is OK.
 * - Detection #6 (missing ICU mirror) compares function-typed leaves in
 *   editorial.ts vs string-typed leaves at the same path in en.ts. If
 *   editorial has a function and en.ts has no value, it's likely
 *   missing a mirror. Helpers that never reach useTranslations (legacy
 *   direct imports only) generate false positives — see comment per
 *   match.
 *
 * The script is intentionally dependency-free beyond Node + tsx so it
 * runs anywhere we have the editorial bundle source available.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import path from "node:path";
import { pathToFileURL } from "node:url";

const WEB_ROOT = path.resolve(__dirname, "..", "apps", "web");
const EDITORIAL_PATH = path.join(WEB_ROOT, "src", "lib", "content", "editorial.ts");
const EN_BUNDLE_PATH = path.join(WEB_ROOT, "src", "lib", "content", "messages", "en.ts");
const ES_BUNDLE_PATH = path.join(WEB_ROOT, "src", "lib", "content", "messages", "es.ts");

// ─────────────────────────────────────────────────────────────────────
// Constants — keyword sets

/** Web3 jargon that should NOT appear in user-facing UI strings.
 *  Per the brief, these terms are reserved for docs / legal / advanced
 *  surfaces. Matches are case-insensitive against the string value. */
const WEB3_JARGON: ReadonlyArray<RegExp> = [
  /\bNFT\b/i,
  /\bmint\b/i,
  /\bmintear\b/i,
  /\bmintea(?:n|r)\b/i,
  /\bon[-\s]?chain\b/i,
  /\bsmart contract\b/i,
  /\bblockchain\b/i,
  /\bcadena de bloques\b/i,
  /\bgas fee\b/i,
  /\bgas\b/i,
];

/** Risky cognitive / medical claims. Inversions still get flagged for
 *  manual review (the brief is hard about this). */
const RISKY_HEALTH_CLAIMS: ReadonlyArray<RegExp> = [
  /\bAlzheimer\b/i,
  /\bdementia\b/i,
  /\bdemencia\b/i,
  /\bcure(?:s|d)?\b/i,
  /\bcura\b/i,
  /\bcuras?\b/i,
  /\bneurodegenerative\b/i,
  /\bneurodegenerativ[ao]s?\b/i,
  /\bmedical treatment\b/i,
  /\btratamiento m[eé]dico\b/i,
  /\bclinically proven\b/i,
  /\bcl[ií]nicamente probado\b/i,
  /\bdoctor[- ]recommended\b/i,
  /\bprevents? cognitive decline\b/i,
  /\bpreviene (?:el )?deterioro cognitivo\b/i,
  /\btherap(?:y|ies)\b/i,
  /\bterapias?\b/i,
];

/** Namespaces where Web3 vocabulary is explicitly acceptable. Matches
 *  in these paths are still printed but tagged so the reviewer can
 *  skip them faster. */
const WEB3_ALLOWLIST_NAMESPACES = new Set([
  "LEGAL_COPY",
  "LEGAL_SHELL_COPY",
  "WHY_PAGE_COPY",
  "ABOUT_COPY",
  "PRIVACY_COPY",
  "TERMS_COPY",
  "COGNITIVE_DISCLAIMER_COPY",
  // Internal devs / advanced surfaces:
  "ACCOUNT_SHEET_COPY",
  "STATUS_STRIP_COPY",
  "PRO_COPY",
  // Victory NFT lives here intentionally; the spec keeps "Victory" as
  // the user-facing word and lets "on-chain" appear in subcopy.
  "VICTORY_PAGE_COPY",
  "VICTORY_CLAIM_COPY",
  "VICTORY_CELEBRATION_COPY",
]);

/** Path segments that strongly suggest the string is rendered inside a
 *  button / CTA / short-label affordance. Heuristic — false positives
 *  expected, reviewer clears them. */
const BUTTON_LIKE_PATH_HINTS = [
  "cta",
  "button",
  "label",
  "action",
  "primaryCta",
  "secondaryCta",
];

/** Length threshold for "button-like" strings before we warn.
 *  Per the brief, 1–2 words / max 3. ~25 characters covers typical
 *  2–3-word English imperatives; ES tends to need ~30. We use 32 to
 *  reduce false positives in ES. */
const BUTTON_LENGTH_THRESHOLD = 32;

/** ICU placeholders / format tokens never count toward "long button"
 *  detection — the user sees the resolved value, not the template. */
const ICU_PLACEHOLDER_RE = /\{[^}]*\}/g;

// ─────────────────────────────────────────────────────────────────────
// Loaders

type LeafKind = "string" | "function" | "other";
type Leaf = {
  path: string[];
  value: unknown;
  kind: LeafKind;
};

function classify(value: unknown): LeafKind {
  if (typeof value === "string") return "string";
  if (typeof value === "function") return "function";
  return "other";
}

/** Walks a plain object (or array) and returns every leaf with its
 *  dotted path. Leaves include strings, functions, numbers, booleans;
 *  nested arrays of primitives flatten as numbered paths. */
function collectLeaves(root: unknown, basePath: string[] = []): Leaf[] {
  const out: Leaf[] = [];
  if (root === null || root === undefined) return out;
  if (Array.isArray(root)) {
    root.forEach((item, idx) => {
      out.push(...collectLeaves(item, [...basePath, String(idx)]));
    });
    return out;
  }
  if (typeof root === "object") {
    for (const [key, value] of Object.entries(root)) {
      out.push(...collectLeaves(value, [...basePath, key]));
    }
    return out;
  }
  // Primitive / function leaf.
  out.push({ path: basePath, value: root, kind: classify(root) });
  return out;
}

async function loadModule(absPath: string): Promise<Record<string, any>> {
  // tsx registers a Node loader so `import()` resolves .ts directly.
  return (await import(pathToFileURL(absPath).href)) as Record<string, any>;
}

// ─────────────────────────────────────────────────────────────────────
// Reporting helpers

type Finding = {
  category: string;
  pathStr: string;
  message: string;
};

const findings: Finding[] = [];

function record(category: string, pathStr: string, message: string) {
  findings.push({ category, pathStr, message });
}

function formatPath(parts: string[]): string {
  return parts.join(".");
}

// ─────────────────────────────────────────────────────────────────────
// Audits

function auditOrphanEsKeys(enLeaves: Leaf[], esLeaves: Leaf[]) {
  const enPaths = new Set(enLeaves.map((l) => formatPath(l.path)));
  for (const leaf of esLeaves) {
    const p = formatPath(leaf.path);
    if (!enPaths.has(p)) {
      record(
        "ES_ORPHAN_KEY",
        p,
        `Key exists in es.ts but not in en.ts. Likely a rename, typo, or stale override.`,
      );
    }
  }
}

function auditMissingEsOverrides(enLeaves: Leaf[], esLeaves: Leaf[]) {
  const esPaths = new Set(esLeaves.map((l) => formatPath(l.path)));
  // Group missing keys by top-level namespace so the report stays compact.
  const missingByNamespace = new Map<string, number>();
  for (const leaf of enLeaves) {
    if (leaf.kind !== "string") continue;
    const p = formatPath(leaf.path);
    if (!esPaths.has(p)) {
      const ns = leaf.path[0] ?? "(root)";
      missingByNamespace.set(ns, (missingByNamespace.get(ns) ?? 0) + 1);
    }
  }
  for (const [ns, count] of missingByNamespace.entries()) {
    record(
      "ES_MISSING_OVERRIDE",
      ns,
      `Namespace "${ns}" has ${count} string keys that fall back to EN (no ES override).`,
    );
  }
}

function looksLikeButtonPath(parts: string[]): boolean {
  const lower = parts.map((p) => p.toLowerCase());
  return lower.some((segment) =>
    BUTTON_LIKE_PATH_HINTS.some((hint) => segment.includes(hint)),
  );
}

function visualLength(value: string): number {
  // Subtract ICU placeholder template length so a literal "{name}"
  // doesn't inflate the count. We add a conservative 6-char allowance
  // per placeholder for typical short tokens (e.g. names, counts).
  const placeholders = value.match(ICU_PLACEHOLDER_RE) ?? [];
  const placeholderRawLen = placeholders.reduce(
    (sum, m) => sum + m.length,
    0,
  );
  return value.length - placeholderRawLen + placeholders.length * 6;
}

function auditLongButtonStrings(enLeaves: Leaf[], esLeaves: Leaf[]) {
  for (const leaf of [...enLeaves, ...esLeaves]) {
    if (leaf.kind !== "string") continue;
    if (!looksLikeButtonPath(leaf.path)) continue;
    const value = leaf.value as string;
    if (visualLength(value) > BUTTON_LENGTH_THRESHOLD) {
      record(
        "LONG_BUTTON_COPY",
        formatPath(leaf.path),
        `"${value}" → ${visualLength(value)} chars (button heuristic, threshold ${BUTTON_LENGTH_THRESHOLD}). Per brief, buttons should be 1–2 words.`,
      );
    }
  }
}

function auditWeb3Jargon(enLeaves: Leaf[], esLeaves: Leaf[]) {
  for (const leaf of [...enLeaves, ...esLeaves]) {
    if (leaf.kind !== "string") continue;
    const value = leaf.value as string;
    for (const pattern of WEB3_JARGON) {
      if (pattern.test(value)) {
        const namespace = leaf.path[0] ?? "";
        const allowed = WEB3_ALLOWLIST_NAMESPACES.has(namespace);
        record(
          "WEB3_JARGON",
          formatPath(leaf.path),
          `Matches "${pattern.source}" in "${value}".${allowed ? " [Allowed namespace — likely intentional, confirm manually]" : " Move technical wording to subcopy or rephrase per brief §5."}`,
        );
        break; // one warning per leaf is enough
      }
    }
  }
}

function auditHealthClaims(enLeaves: Leaf[], esLeaves: Leaf[]) {
  for (const leaf of [...enLeaves, ...esLeaves]) {
    if (leaf.kind !== "string") continue;
    const value = leaf.value as string;
    for (const pattern of RISKY_HEALTH_CLAIMS) {
      if (pattern.test(value)) {
        record(
          "RISKY_HEALTH_CLAIM",
          formatPath(leaf.path),
          `Matches "${pattern.source}" in "${value}". Per brief §6, avoid medical claims; confirm framing or reword.`,
        );
        break;
      }
    }
  }
}

function auditMissingIcuMirrors(editorialLeaves: Leaf[], enLeaves: Leaf[]) {
  // Build a map of every editorial path → its kind.
  const editorialByPath = new Map<string, Leaf>();
  for (const leaf of editorialLeaves) {
    editorialByPath.set(formatPath(leaf.path), leaf);
  }
  const enByPath = new Map<string, Leaf>();
  for (const leaf of enLeaves) {
    enByPath.set(formatPath(leaf.path), leaf);
  }

  for (const [p, leaf] of editorialByPath.entries()) {
    if (leaf.kind !== "function") continue;
    const enLeaf = enByPath.get(p);
    // No EN bundle entry at this path → function helper was stripped
    // and no ICU mirror was added. Likely OK for legacy-only helpers
    // (consumed via direct import, never useTranslations), but worth
    // surfacing so reviewer can decide.
    if (!enLeaf) {
      record(
        "MISSING_ICU_MIRROR",
        p,
        `Function helper in editorial.ts has no ICU mirror in messages/en.ts. If any component consumes this via useTranslations, add a string mirror (see lib/content/README.md §2). Safe to ignore for legacy-only helpers.`,
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// Reporter

function printReport() {
  const byCategory = new Map<string, Finding[]>();
  for (const f of findings) {
    if (!byCategory.has(f.category)) byCategory.set(f.category, []);
    byCategory.get(f.category)!.push(f);
  }

  const order: Array<[string, string]> = [
    ["ES_ORPHAN_KEY", "1. ES keys not in EN (likely typos / renames)"],
    ["ES_MISSING_OVERRIDE", "2. EN namespaces without full ES override"],
    ["LONG_BUTTON_COPY", "3. Button-like strings over length budget"],
    ["WEB3_JARGON", "4. Web3 jargon in copy"],
    ["RISKY_HEALTH_CLAIM", "5. Risky cognitive / medical claims"],
    ["MISSING_ICU_MIRROR", "6. Function helpers possibly missing ICU mirror"],
  ];

  let total = 0;
  for (const [cat, heading] of order) {
    const items = byCategory.get(cat) ?? [];
    total += items.length;
    console.log("");
    console.log(`──────── ${heading} (${items.length}) ────────`);
    if (items.length === 0) {
      console.log("   ✓ none");
      continue;
    }
    for (const item of items) {
      console.log(`   • ${item.pathStr}`);
      console.log(`       ${item.message}`);
    }
  }

  console.log("");
  console.log("═════════════════════════════════════════════════════════");
  console.log(`Total findings: ${total}`);
  console.log("This is a warn-only report; exit code stays 0.");
  console.log("Brief: docs/content/chesscito-language-brief.md");
  console.log("Arch:  apps/web/src/lib/content/README.md");
  console.log("═════════════════════════════════════════════════════════");
}

// ─────────────────────────────────────────────────────────────────────
// Main

async function main() {
  console.log("Chesscito content audit — non-destructive editorial linter");
  console.log(`editorial.ts: ${path.relative(process.cwd(), EDITORIAL_PATH)}`);
  console.log(`en bundle:    ${path.relative(process.cwd(), EN_BUNDLE_PATH)}`);
  console.log(`es bundle:    ${path.relative(process.cwd(), ES_BUNDLE_PATH)}`);

  let editorialModule: Record<string, any>;
  let enModule: Record<string, any>;
  let esModule: Record<string, any>;

  try {
    [editorialModule, enModule, esModule] = await Promise.all([
      loadModule(EDITORIAL_PATH),
      loadModule(EN_BUNDLE_PATH),
      loadModule(ES_BUNDLE_PATH),
    ]);
  } catch (err) {
    console.error("");
    console.error("✗ Could not load editorial / bundle modules:");
    console.error(`  ${err instanceof Error ? err.message : String(err)}`);
    console.error("");
    console.error("This usually means there's a TS compile error in one of the");
    console.error("files. Fix the upstream error and re-run.");
    process.exit(0); // still warn-only
  }

  // `import * as editorial` exposes named exports as top-level keys; we
  // wrap them into a shape consistent with the bundle to make the
  // tree-walk uniform.
  const editorialObj: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(editorialModule)) {
    if (k === "default") continue;
    editorialObj[k] = v;
  }
  const enObj = (enModule.default ?? enModule) as Record<string, unknown>;
  const esObj = (esModule.default ?? esModule) as Record<string, unknown>;

  const editorialLeaves = collectLeaves(editorialObj);
  const enLeaves = collectLeaves(enObj);
  const esLeaves = collectLeaves(esObj);

  auditOrphanEsKeys(enLeaves, esLeaves);
  auditMissingEsOverrides(enLeaves, esLeaves);
  auditLongButtonStrings(enLeaves, esLeaves);
  auditWeb3Jargon(enLeaves, esLeaves);
  auditHealthClaims(enLeaves, esLeaves);
  auditMissingIcuMirrors(editorialLeaves, enLeaves);

  printReport();
}

void main();
