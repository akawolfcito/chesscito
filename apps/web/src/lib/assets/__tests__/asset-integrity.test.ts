import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";

/** Walk up from __dirname until we find package.json with name "web". */
function findProjectRoot(): string {
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    const pkg = join(dir, "package.json");
    if (existsSync(pkg)) {
      const content = JSON.parse(readFileSync(pkg, "utf-8"));
      if (content.name === "web") return dir;
    }
    dir = dirname(dir);
  }
  throw new Error("Could not find apps/web root");
}

const ROOT = findProjectRoot();
const PUBLIC = join(ROOT, "public");
const SRC = join(ROOT, "src");

/** Recursively collect all files matching given extensions, excluding test files. */
function walkFiles(dir: string, exts: string[]): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.name === "__tests__" || entry.name === "node_modules") continue;
    if (entry.isDirectory()) {
      results.push(...walkFiles(full, exts));
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

/** Walk all files (including test dirs) for size checks. */
function walkAllFiles(dir: string, exts: string[]): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkAllFiles(full, exts));
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

/** Extract all /art/... asset paths referenced in source files. */
function extractAssetPaths(srcDir: string): Set<string> {
  const files = walkFiles(srcDir, [".ts", ".tsx", ".css"]);
  const paths = new Set<string>();
  const pattern = /["'`](\/art\/[^"'`\s)]+\.\w+)/g;

  for (const file of files) {
    const content = readFileSync(file, "utf-8");
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      paths.add(match[1]);
    }
  }

  return paths;
}

/**
 * Detect .replace(".png", ".webp/.avif") patterns and derive variant paths
 * only for PNGs that are used as the source in a <picture> element
 * (i.e. the same variable/path feeds into srcSet via .replace).
 */
function extractDerivedPaths(srcDir: string, basePaths: Set<string>): Set<string> {
  const files = walkFiles(srcDir, [".ts", ".tsx"]);
  const derived = new Set<string>();

  for (const file of files) {
    const content = readFileSync(file, "utf-8");
    // Find all PNG paths that are .replace'd in this file
    // Pattern: someVar.replace(".png", ".webp") or literal "/art/x.png".replace(...)
    const replaceUsages = content.matchAll(
      /(\/art\/[^"'`\s)]+\.png)["'`]\)?\.replace\(["']\.png["'],\s*["'](\.webp|\.avif)["']\)/g
    );
    for (const m of replaceUsages) {
      derived.add(m[1].replace(".png", m[2]));
    }

    // Also detect variable-based patterns: src.replace(".png", ".webp")
    // where src is assigned from a PNG art path
    const varReplace = content.matchAll(
      /(\w+)\.replace\(["']\.png["'],\s*["'](\.webp|\.avif)["']\)/g
    );
    for (const m of varReplace) {
      const varName = m[1];
      const ext = m[2];
      // Find what PNG paths this variable could hold
      for (const p of basePaths) {
        if (!p.endsWith(".png")) continue;
        // Check if this path is assigned/mapped to the variable in the same file
        // Look for patterns like: PIECE_IMG[x] where PIECE_IMG contains the path
        if (content.includes(p)) {
          // Only derive if the path could flow into the .replace call
          // Heuristic: the path and the .replace are in the same file
          // and the path is used in an object/map that feeds <picture> sources
          const hasSourceTag = content.includes("<source") || content.includes("srcSet");
          if (hasSourceTag) {
            derived.add(p.replace(".png", ext));
          }
        }
      }
    }
  }

  return derived;
}

describe("Asset integrity", () => {
  const directPaths = extractAssetPaths(SRC);
  const derivedPaths = extractDerivedPaths(SRC, directPaths);
  const allPaths = new Set([...directPaths, ...derivedPaths]);

  it("should find at least 10 referenced asset paths", () => {
    assert.ok(
      allPaths.size >= 10,
      `Expected at least 10 asset paths, found ${allPaths.size}`
    );
  });

  for (const assetPath of allPaths) {
    it(`referenced asset exists: ${assetPath}`, () => {
      const fullPath = join(PUBLIC, assetPath);
      assert.ok(
        existsSync(fullPath),
        `Asset referenced in source code does not exist on disk: ${assetPath}`
      );
    });
  }

  it("should not have oversized assets (>3MB)", () => {
    const artDir = join(PUBLIC, "art");
    const allFiles = walkAllFiles(artDir, [".png", ".jpg", ".webp", ".avif"]);
    const oversized: string[] = [];
    const MAX_SIZE = 3 * 1024 * 1024; // 3MB

    for (const file of allFiles) {
      const stat = statSync(file);
      if (stat.size > MAX_SIZE) {
        const relative = file.replace(PUBLIC, "");
        oversized.push(`${relative} (${(stat.size / 1024 / 1024).toFixed(1)}MB)`);
      }
    }

    assert.deepStrictEqual(
      oversized,
      [],
      `Assets exceeding 3MB: ${oversized.join(", ")}`
    );
  });
});
