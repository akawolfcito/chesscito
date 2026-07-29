import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import en from "../en";

/**
 * Every literal `t("key")` call must resolve to a string in the EN bundle.
 *
 * Two ways a key silently breaks:
 *   1. The key never existed (COACH_COPY.playCta, 2026-06-15).
 *   2. editorial.ts declares it as a FUNCTION helper — stripFunctions removes it
 *      from the bundle and en.ts needs an explicit ICU mirror.
 * Either way next-intl renders the raw key path into the UI.
 */

type Node = Record<string, unknown>;

const MISSING = Symbol("missing");

function resolve(root: unknown, keyPath: string): unknown {
  let cursor: unknown = root;
  for (const segment of keyPath.split(".")) {
    if (cursor === null || typeof cursor !== "object") return MISSING;
    if (!(segment in (cursor as Node))) return MISSING;
    cursor = (cursor as Node)[segment];
  }
  return cursor;
}

const SRC = path.resolve(__dirname, "../../../..");

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "test-utils") continue;
      sourceFiles(full, out);
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const BINDING =
  /(?:const|let)\s+([A-Za-z0-9_$]+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*["'`]([^"'`]+)["'`]\s*\)/g;

describe("t() key resolution — no raw key paths in the UI", () => {
  it("every literal t(\"key\") call resolves to a string in the EN bundle", () => {
    const broken: string[] = [];

    for (const file of sourceFiles(SRC)) {
      const source = readFileSync(file, "utf8");
      const bindings = new Map<string, string | null>();
      BINDING.lastIndex = 0;
      let bind: RegExpExecArray | null;
      while ((bind = BINDING.exec(source)) !== null) {
        // Same identifier bound to two namespaces in one file (different scopes):
        // a regex cannot tell which call belongs to which. Mark it ambiguous.
        bindings.set(bind[1], bindings.has(bind[1]) ? null : bind[2]);
      }
      if (bindings.size === 0) continue;

      for (const [varName, namespace] of bindings) {
        if (namespace === null) continue;
        // The same identifier also arrives as a typed function parameter
        // (`function label(t: ArenaTranslator)`) — those calls belong to
        // whatever namespace the caller passed, not to this binding.
        const escaped = varName.replace(/\$/g, "\\$");
        if (new RegExp(`[(,]\\s*${escaped}\\s*:`).test(source)) continue;
        // t.raw() is the escape hatch for structured / optional values
        // (arrays, env-derived hrefs) — callers guard it, so only the
        // plain string-returning forms are checked here.
        const call = new RegExp(`\\b${escaped}(\\.rich|\\.markup)?\\(\\s*["']([^"']+)["']`, "g");
        let hit: RegExpExecArray | null;
        while ((hit = call.exec(source)) !== null) {
          const keyPath = `${namespace}.${hit[2]}`;
          if (typeof resolve(en, keyPath) !== "string") {
            broken.push(`${path.relative(SRC, file)} → ${keyPath}`);
          }
        }
      }
    }

    expect([...new Set(broken)].sort()).toEqual([]);
  });
});
