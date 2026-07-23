import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// These guards enforce the isolation contract by scanning harness source at
// test time. They are the machine-checked version of the task's hard rules.

const SRC_DIR = dirname(fileURLToPath(import.meta.url)).replace(/\/__tests__$/, "");

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const files = collectSourceFiles(SRC_DIR);
const sources = files.map((f) => ({ file: f, text: readFileSync(f, "utf8") }));

// This guard file must name the forbidden token in order to search for it, so
// it is excluded from the scans that would otherwise flag itself.
const SELF = "guards.test.ts";
const scanned = sources.filter(({ file }) => !file.endsWith(SELF));

describe("isolation guards", () => {
  it("has source files to scan", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("(6) never references the PRIVY_APP_SECRET env token in app code", () => {
    // Match the env-token form (with underscore), not prose like "App Secret"
    // in a comment explaining we do NOT use it.
    const offenders = scanned.filter(({ text }) => /APP_SECRET/.test(text));
    expect(offenders.map((o) => o.file)).toEqual([]);
  });

  it("(6b) the only Privy env var read is VITE_PRIVY_APP_ID", () => {
    const envRefs = new Set<string>();
    for (const { text } of scanned) {
      for (const m of text.matchAll(/import\.meta\.env\.(\w+)/g)) {
        envRefs.add(m[1]);
      }
    }
    for (const ref of envRefs) {
      expect(ref).toBe("VITE_PRIVY_APP_ID");
    }
  });

  it("(7) never imports productive Chesscito code (apps/web, @/ alias, ../../apps)", () => {
    const offenders: string[] = [];
    for (const { file, text } of scanned) {
      for (const m of text.matchAll(/from\s+["']([^"']+)["']/g)) {
        const spec = m[1];
        if (
          spec.startsWith("@/") ||
          spec.includes("apps/web") ||
          /\.\.\/.*apps\//.test(spec)
        ) {
          offenders.push(`${file}: ${spec}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("declares Celo via first-class viem/wagmi chains, not hand-rolled objects", () => {
    const chains = sources.find((s) => s.file.endsWith("chains.ts"));
    expect(chains?.text).toMatch(/from\s+["']wagmi\/chains["']/);
    expect(chains?.text).not.toMatch(/id:\s*42220/); // no manual chain declaration
  });
});
